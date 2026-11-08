import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { parseKfuHtml } from "../src/lib/kfu-importer";
import { validateSnapshotCompleteness } from "../src/lib/kfu-monitor/validator";
import { maleOfferings, femaleOfferings } from "../src/data/offerings";
import {
  KFU_BUSINESS_DATASETS,
  type KfuIngestPayload,
  type KfuIngestResponse,
} from "../src/lib/kfu-monitor/types";

// Configuration defaults
const CONFIG = {
  HTTP_TIMEOUT_MS: 20000,
  MAX_RETRIES: 2,
  BACKOFF_DELAY_MS: 1500,
  LOCK_STALE_MS: 900000, // 15 minutes
  USER_AGENT:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

// Log paths
const LOG_DIR = path.resolve("logs");
const LOG_FILE = path.join(LOG_DIR, "kfu-worker.log");
const LOCK_FILE = path.join(LOG_DIR, "kfu-worker.lock");

function ensureLogDir(): void {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

export function log(level: "INFO" | "WARN" | "ERROR", message: string): void {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${message}`;
  console.log(line);
  try {
    ensureLogDir();
    fs.appendFileSync(LOG_FILE, line + "\n", "utf8");
  } catch {
    // Ignore logging write failures
  }
}

// Lock file implementation
function acquireLock(): boolean {
  ensureLogDir();
  if (fs.existsSync(LOCK_FILE)) {
    try {
      const stats = fs.statSync(LOCK_FILE);
      const ageMs = Date.now() - stats.mtimeMs;
      if (ageMs > CONFIG.LOCK_STALE_MS) {
        log("WARN", `Found stale lock file (age ${Math.round(ageMs / 1000)}s). Clearing it.`);
        fs.unlinkSync(LOCK_FILE);
      } else {
        const lockContent = fs.readFileSync(LOCK_FILE, "utf8");
        log("WARN", `Worker already running with lock: ${lockContent.trim()}`);
        return false;
      }
    } catch {
      return false;
    }
  }

  try {
    const lockInfo = JSON.stringify({ pid: process.pid, hostname: os.hostname(), startedAt: new Date().toISOString() });
    fs.writeFileSync(LOCK_FILE, lockInfo, { flag: "wx" });
    return true;
  } catch {
    return false;
  }
}

function releaseLock(): void {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
    }
  } catch {
    // Ignore unlock failure
  }
}

// Secret resolution from protected Windows user profile or env
export function resolveIngestionSecret(): string | null {
  // 1. Direct env variable
  if (process.env.KFU_INGESTION_SECRET) {
    return process.env.KFU_INGESTION_SECRET.trim();
  }

  // 2. Protected user config in AppData\Local\lemon-worker\config.json
  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || "C:\\", "AppData", "Local");
  const configPath = path.join(localAppData, "lemon-worker", "config.json");
  if (fs.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (cfg.ingestionSecret) {
        return cfg.ingestionSecret.trim();
      }
    } catch {
      // Ignore config read error
    }
  }

  // 3. Fallback to git-ignored .env.local
  const envLocalPath = path.resolve(".env.local");
  if (fs.existsSync(envLocalPath)) {
    try {
      const envText = fs.readFileSync(envLocalPath, "utf8");
      const match = envText.match(/KFU_INGESTION_SECRET=([^\r\n]+)/);
      if (match && match[1]) {
        return match[1].trim();
      }
    } catch {
      // Ignore
    }
  }

  return null;
}

export function resolveApiEndpoint(): string {
  if (process.env.KFU_INGESTION_ENDPOINT) {
    return process.env.KFU_INGESTION_ENDPOINT.trim();
  }

  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || "C:\\", "AppData", "Local");
  const configPath = path.join(localAppData, "lemon-worker", "config.json");
  if (fs.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (cfg.apiEndpoint) {
        return cfg.apiEndpoint.trim();
      }
    } catch {
      // Ignore
    }
  }

  return "https://yourcampuspallemon.netlify.app/api/kfu/ingest";
}

// Polite HTTP fetch with bounded timeout and retries
async function fetchSourceHtml(url: string, label: string): Promise<string> {
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < CONFIG.MAX_RETRIES) {
    attempt += 1;
    log("INFO", `[${label}] Fetching from KFU (attempt ${attempt}/${CONFIG.MAX_RETRIES}) -> ${url}`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG.HTTP_TIMEOUT_MS);
    const start = Date.now();

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": CONFIG.USER_AGENT,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "ar-SA,ar;q=0.9,en-US;q=0.8,en;q=0.7",
          Referer:
            "https://www.kfu.edu.sa/ar/Deans/AdmissionRecordsDeanship/Documents/acadPlan/studyTables.html?cry=1448&sm=20",
        },
      });

      clearTimeout(timer);
      const elapsedMs = Date.now() - start;

      if (!response.ok) {
        throw new Error(`KFU server returned HTTP ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      log("INFO", `[${label}] HTTP 200 received in ${elapsedMs}ms (${text.length} bytes)`);

      // Reject redirected homepage
      const isSharePoint = text.includes("SharePoint") || text.includes("Microsoft SharePoint");
      const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const pageTitle = titleMatch ? titleMatch[1].trim() : "Unknown Title";

      if (isSharePoint || pageTitle.includes("الصفحة الرئيسية")) {
        throw new Error(`Received university portal homepage instead of timetable (${pageTitle})`);
      }

      return text;
    } catch (err: unknown) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err : new Error(String(err));
      log("WARN", `[${label}] Attempt ${attempt} failed: ${lastError.message}`);
      if (attempt < CONFIG.MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, CONFIG.BACKOFF_DELAY_MS));
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${label} from KFU`);
}

export async function runKfuWorker(options?: {
  endpointOverride?: string;
  secretOverride?: string;
  dryRun?: boolean;
}): Promise<{ exitCode: number; summary: string }> {
  if (!acquireLock()) {
    return { exitCode: 2, summary: "Worker concurrency lock active. Another refresh is currently in progress." };
  }

  try {
    log("INFO", "=== LEMON-039 KFU Refresh Worker Started ===");

    const secret = options?.secretOverride ?? resolveIngestionSecret();
    if (!secret) {
      const msg = "Ingestion secret not found in environment, protected config, or .env.local";
      log("ERROR", msg);
      return { exitCode: 1, summary: msg };
    }

    const endpoint = options?.endpointOverride ?? resolveApiEndpoint();
    log("INFO", `Ingestion target endpoint: ${endpoint}`);

    // 1. Fetch Male and Female HTML
    const maleTarget = KFU_BUSINESS_DATASETS["11"];
    const femaleTarget = KFU_BUSINESS_DATASETS["12"];

    const maleHtml = await fetchSourceHtml(maleTarget.url, "Male");
    const femaleHtml = await fetchSourceHtml(femaleTarget.url, "Female");

    // 2. Parse HTML
    log("INFO", "Parsing Male timetable HTML...");
    const maleSnapshot = parseKfuHtml(maleHtml, {
      termId: maleTarget.termId,
      collegeCode: maleTarget.collegeCode,
      categoryCode: maleTarget.categoryCode,
      sourceUrl: maleTarget.url,
    });
    log("INFO", `Male parsed: ${maleSnapshot.courses.length} courses, ${maleSnapshot.sections.length} sections`);

    log("INFO", "Parsing Female timetable HTML...");
    const femaleSnapshot = parseKfuHtml(femaleHtml, {
      termId: femaleTarget.termId,
      collegeCode: femaleTarget.collegeCode,
      categoryCode: femaleTarget.categoryCode,
      sourceUrl: femaleTarget.url,
    });
    log("INFO", `Female parsed: ${femaleSnapshot.courses.length} courses, ${femaleSnapshot.sections.length} sections`);

    // 3. Validate
    const maleVal = validateSnapshotCompleteness(maleSnapshot, maleOfferings, maleTarget);
    if (!maleVal.isValid) {
      const msg = `Male snapshot validation failed: ${maleVal.failureReason}`;
      log("ERROR", msg);
      return { exitCode: 1, summary: msg };
    }

    const femaleVal = validateSnapshotCompleteness(femaleSnapshot, femaleOfferings, femaleTarget);
    if (!femaleVal.isValid) {
      const msg = `Female snapshot validation failed: ${femaleVal.failureReason}`;
      log("ERROR", msg);
      return { exitCode: 1, summary: msg };
    }

    log("INFO", "Validation passed for both male and female snapshots.");

    if (options?.dryRun) {
      log("INFO", "DRY-RUN completed successfully without publishing.");
      return { exitCode: 0, summary: "Dry run passed. Both categories valid." };
    }

    // 4. Construct Authenticated Ingestion Payload
    const fetchedAt = new Date().toISOString();
    const payload: KfuIngestPayload = {
      maleSnapshot,
      femaleSnapshot,
      sourceMetadata: {
        fetchedAt,
        workerVersion: "1.0.0",
        workerHost: os.hostname(),
      },
    };

    const rawBody = JSON.stringify(payload);
    const nonce = crypto.randomBytes(16).toString("hex");
    const signature = crypto
      .createHmac("sha256", secret)
      .update(`${fetchedAt}:${nonce}:${rawBody}`)
      .digest("hex");

    log("INFO", `Posting ingestion payload to ${endpoint} (Payload size: ${(rawBody.length / 1024).toFixed(1)} KB)...`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-lemon-timestamp": fetchedAt,
        "x-lemon-nonce": nonce,
        "x-lemon-signature": signature,
      },
      body: rawBody,
    });

    if (!response.ok) {
      const errText = await response.text();
      const msg = `Ingestion endpoint returned HTTP ${response.status} ${response.statusText}: ${errText}`;
      log("ERROR", msg);
      return { exitCode: 3, summary: msg };
    }

    const ingestResult = (await response.json()) as KfuIngestResponse;
    const summary = `Successfully published snapshot ${ingestResult.version}: Male ${ingestResult.male.courseCount} courses / ${ingestResult.male.sectionCount} sections; Female ${ingestResult.female.courseCount} courses / ${ingestResult.female.sectionCount} sections.`;
    log("INFO", summary);
    log("INFO", "=== LEMON-039 KFU Refresh Worker Completed Successfully ===");
    return { exitCode: 0, summary };
  } catch (fatalErr: unknown) {
    const errorMsg = fatalErr instanceof Error ? fatalErr.message : String(fatalErr);
    log("ERROR", `Fatal worker error: ${errorMsg}`);
    return { exitCode: 1, summary: errorMsg };
  } finally {
    releaseLock();
  }
}

// Direct execution from CLI or Windows Task Scheduler
if (process.argv[1] && process.argv[1].endsWith("kfu-worker.ts")) {
  const isDryRun = process.argv.includes("--dry-run");
  runKfuWorker({ dryRun: isDryRun }).then((res) => {
    process.exit(res.exitCode);
  });
}
