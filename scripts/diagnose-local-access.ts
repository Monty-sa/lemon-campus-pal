import { parseKfuHtml } from "../src/lib/kfu-importer";
import { validateSnapshotCompleteness } from "../src/lib/kfu-monitor/validator";
import { maleOfferings, femaleOfferings } from "../src/data/offerings";
import { KFU_BUSINESS_DATASETS } from "../src/lib/kfu-monitor/types";

// Safety 90-second overall diagnostic deadline
const deadline = setTimeout(() => {
  console.error("DIAGNOSTIC_TIMEOUT: 90-second overall diagnostic deadline reached.");
  process.exit(1);
}, 90000);

interface CategoryTestResult {
  gender: string;
  categoryCode: "11" | "12";
  url: string;
  status: "PASS" | "BLOCKED";
  httpStatus?: number;
  finalUrl?: string;
  redirected?: boolean;
  byteLength?: number;
  pageTitle?: string;
  isSharePoint?: boolean;
  courseCount?: number;
  sectionCount?: number;
  validationStatus?: string;
  failureReason?: string;
  elapsedMs?: number;
}

async function fetchWithTimeout(url: string, timeoutMs = 20000): Promise<{ response: Response; text: string; elapsedMs: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "ar-SA,ar;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });
    const text = await response.text();
    const elapsedMs = Date.now() - start;
    return { response, text, elapsedMs };
  } finally {
    clearTimeout(timer);
  }
}

async function testCategory(categoryCode: "11" | "12"): Promise<CategoryTestResult> {
  const target = KFU_BUSINESS_DATASETS[categoryCode];
  const gender = categoryCode === "11" ? "Male" : "Female";
  const baseline = categoryCode === "11" ? maleOfferings : femaleOfferings;

  console.log(`[${gender}] STAGE: FETCH_START -> ${target.url}`);

  let attempts = 0;
  let fetchResult: { response: Response; text: string; elapsedMs: number } | null = null;
  let lastError: Error | null = null;

  while (attempts < 2) {
    attempts += 1;
    try {
      fetchResult = await fetchWithTimeout(target.url, 20000);
      break;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[${gender}] Attempt ${attempts} failed: ${lastError.message}`);
      if (attempts < 2) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }

  if (!fetchResult) {
    console.error(`[${gender}] STAGE: FETCH_FAILED after ${attempts} attempts: ${lastError?.message}`);
    return {
      gender,
      categoryCode,
      url: target.url,
      status: "BLOCKED",
      failureReason: `Fetch failed after ${attempts} attempts: ${lastError?.message}`,
    };
  }

  const { response, text, elapsedMs } = fetchResult;
  console.log(`[${gender}] STAGE: HTTP_STATUS -> ${response.status} ${response.statusText} (${elapsedMs}ms)`);
  console.log(`[${gender}] STAGE: FINAL_URL -> ${response.url} (redirected: ${response.redirected})`);
  console.log(`[${gender}] STAGE: BYTES -> ${text.length}`);

  const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const pageTitle = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "N/A";
  const isSharePoint = text.includes("SharePoint") || text.includes("Microsoft SharePoint");
  console.log(`[${gender}] STAGE: PAGE_TITLE -> "${pageTitle}" (SharePoint: ${isSharePoint})`);

  // Check 1: Must be HTTP 200
  if (!response.ok) {
    console.error(`[${gender}] STAGE: REJECTED -> Non-200 HTTP status: ${response.status}`);
    return {
      gender,
      categoryCode,
      url: target.url,
      status: "BLOCKED",
      httpStatus: response.status,
      finalUrl: response.url,
      redirected: response.redirected,
      byteLength: text.length,
      pageTitle,
      isSharePoint,
      failureReason: `HTTP ${response.status} ${response.statusText}`,
    };
  }

  // Check 2: Reject redirected university homepage
  if (isSharePoint || pageTitle.includes("الصفحة الرئيسية") || (response.redirected && response.url.includes("kfu.edu.sa/ar"))) {
    console.error(`[${gender}] STAGE: REJECTED -> Received university homepage / SharePoint portal instead of timetable.`);
    return {
      gender,
      categoryCode,
      url: target.url,
      status: "BLOCKED",
      httpStatus: response.status,
      finalUrl: response.url,
      redirected: response.redirected,
      byteLength: text.length,
      pageTitle,
      isSharePoint,
      failureReason: `Redirected to public homepage portal (${pageTitle})`,
    };
  }

  // Check 3: Parse HTML
  console.log(`[${gender}] STAGE: PARSE_START`);
  let parsedSnapshot;
  try {
    parsedSnapshot = parseKfuHtml(text, {
      termId: target.termId,
      collegeCode: target.collegeCode,
      categoryCode: target.categoryCode,
      sourceUrl: target.url,
    });
  } catch (parseErr: unknown) {
    const msg = parseErr instanceof Error ? parseErr.message : "Parse error";
    console.error(`[${gender}] STAGE: PARSE_FAILED -> ${msg}`);
    return {
      gender,
      categoryCode,
      url: target.url,
      status: "BLOCKED",
      httpStatus: response.status,
      finalUrl: response.url,
      redirected: response.redirected,
      byteLength: text.length,
      pageTitle,
      isSharePoint,
      failureReason: `Parse failed: ${msg}`,
    };
  }

  console.log(`[${gender}] STAGE: COURSES -> ${parsedSnapshot.courses.length}`);
  console.log(`[${gender}] STAGE: SECTIONS -> ${parsedSnapshot.sections.length}`);
  if (parsedSnapshot.warnings.length > 0) {
    console.log(`[${gender}] PARSE_WARNINGS: ${parsedSnapshot.warnings.join("; ")}`);
  }

  // Check 4: Validate completeness against baseline
  const valResult = validateSnapshotCompleteness(parsedSnapshot, baseline, target);
  console.log(`[${gender}] STAGE: VALIDATE_RESULT -> isValid: ${valResult.isValid}, status: ${valResult.status}`);
  if (valResult.failureReason) {
    console.error(`[${gender}] VALIDATE_FAILURE_REASON -> ${valResult.failureReason}`);
  }

  if (!valResult.isValid) {
    return {
      gender,
      categoryCode,
      url: target.url,
      status: "BLOCKED",
      httpStatus: response.status,
      finalUrl: response.url,
      redirected: response.redirected,
      byteLength: text.length,
      pageTitle,
      isSharePoint,
      courseCount: parsedSnapshot.courses.length,
      sectionCount: parsedSnapshot.sections.length,
      validationStatus: valResult.status,
      failureReason: valResult.failureReason,
    };
  }

  return {
    gender,
    categoryCode,
    url: target.url,
    status: "PASS",
    httpStatus: response.status,
    finalUrl: response.url,
    redirected: response.redirected,
    byteLength: text.length,
    pageTitle,
    isSharePoint,
    courseCount: parsedSnapshot.courses.length,
    sectionCount: parsedSnapshot.sections.length,
    validationStatus: valResult.status,
    elapsedMs,
  };
}

async function main() {
  console.log("=== LEMON-039 PHASE 1: DIRECT WINDOWS ACCESS DIAGNOSTIC ===");
  console.log(`Timestamp: ${new Date().toISOString()}`);

  const maleResult = await testCategory("11");
  console.log("-----------------------------------------------------------");
  const femaleResult = await testCategory("12");
  console.log("===========================================================");

  console.log("\n=== SUMMARY RESULTS ===");
  console.log(`Male (11): ${maleResult.status} | Courses: ${maleResult.courseCount ?? 0} | Sections: ${maleResult.sectionCount ?? 0} | Bytes: ${maleResult.byteLength ?? 0}`);
  console.log(`Female (12): ${femaleResult.status} | Courses: ${femaleResult.courseCount ?? 0} | Sections: ${femaleResult.sectionCount ?? 0} | Bytes: ${femaleResult.byteLength ?? 0}`);

  const overallPass = maleResult.status === "PASS" && femaleResult.status === "PASS";
  console.log(`OVERALL PHASE 1: ${overallPass ? "PASS" : "BLOCKED"}`);

  clearTimeout(deadline);
  process.exit(overallPass ? 0 : 1);
}

main().catch((err) => {
  console.error("FATAL DIAGNOSTIC ERROR:", err);
  clearTimeout(deadline);
  process.exit(1);
});
