import { parseKfuHtml } from "@/lib/kfu-importer";
import type { DataImport } from "@/lib/schema";
import { computeSnapshotDiff } from "./diff";
import { validateSnapshotCompleteness } from "./validator";
import { getSnapshotStore } from "./storage";
import {
  KFU_BUSINESS_DATASETS,
  KFU_OWNER_ATTESTATION,
  type FullPipelineExecutionResult,
  type KfuDatasetTarget,
  type KfuGenderCategory,
  type KfuRefreshMetadata,
  type PipelineExecutionResult,
} from "./types";
import { maleOfferings, femaleOfferings } from "@/data/offerings";

const activeLocks = new Set<string>();

export function isCronExecutionApproved(): boolean {
  return process.env.KFU_MONITOR_CRON_ENABLED === "true";
}

export function acquireJobLock(key: string): boolean {
  if (activeLocks.has(key)) {
    return false;
  }
  activeLocks.add(key);
  return true;
}

export function releaseJobLock(key: string): void {
  activeLocks.delete(key);
}

export const HTTP_POLITENESS_CONFIG = {
  USER_AGENT:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  TIMEOUT_MS: 15000,
  MAX_RETRIES: 1,
  BACKOFF_DELAY_MS: 1500,
};

export interface FetchResponseInfo {
  finalUrl: string;
  redirected: boolean;
  status: number;
}

export async function fetchWithPolitePolicy(
  url: string,
  options?: {
    onResponseInfo?: (info: FetchResponseInfo) => void;
  },
): Promise<string> {
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= HTTP_POLITENESS_CONFIG.MAX_RETRIES) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), HTTP_POLITENESS_CONFIG.TIMEOUT_MS);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": HTTP_POLITENESS_CONFIG.USER_AGENT,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
          "Accept-Language": "ar-SA,ar;q=0.9,en-US;q=0.8,en;q=0.7",
          Referer:
            "https://www.kfu.edu.sa/ar/Deans/AdmissionRecordsDeanship/Documents/acadPlan/studyTables.html?cry=1448&sm=20",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "same-site",
          "Upgrade-Insecure-Requests": "1",
          "Cache-Control": "no-cache",
        },
      });

      clearTimeout(timer);

      if (options?.onResponseInfo) {
        options.onResponseInfo({
          finalUrl: response.url || url,
          redirected: response.redirected,
          status: response.status,
        });
      }

      if (!response.ok) {
        throw new Error(`KFU server returned HTTP ${response.status} ${response.statusText}`);
      }

      return await response.text();
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      attempt += 1;
      if (attempt <= HTTP_POLITENESS_CONFIG.MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, HTTP_POLITENESS_CONFIG.BACKOFF_DELAY_MS));
      }
    }
  }

  throw lastError ?? new Error("Failed to fetch KFU timetable after retries");
}

/**
 * Refreshes an individual dataset.
 */
export async function executeDatasetRefresh(
  categoryCode: KfuGenderCategory,
  options?: {
    previousSnapshot?: DataImport | null;
    htmlContent?: string;
    publish?: boolean;
  },
): Promise<PipelineExecutionResult> {
  const target: KfuDatasetTarget = KFU_BUSINESS_DATASETS[categoryCode];
  const lockKey = `kfu-refresh:${target.termId}:${target.categoryCode}`;

  if (!acquireJobLock(lockKey)) {
    return {
      target,
      status: "locked",
      changesCount: 0,
      changes: [],
      snapshotPublished: false,
      preservedPreviousSnapshot: true,
      warnings: ["Job already running for this dataset. Skipping concurrent run to prevent server strain."],
    };
  }

  try {
    let html = options?.htmlContent;
    if (!html) {
      try {
        html = await fetchWithPolitePolicy(target.url);
      } catch (fetchError: unknown) {
        const msg = fetchError instanceof Error ? fetchError.message : "Fetch failed";
        return {
          target,
          status: "fetch_failed",
          changesCount: 0,
          changes: [],
          snapshotPublished: false,
          preservedPreviousSnapshot: true,
          warnings: [msg],
          errorMessage: msg,
        };
      }
    }

    let candidateImport: DataImport;
    try {
      candidateImport = parseKfuHtml(html, {
        termId: target.termId,
        collegeCode: target.collegeCode,
        categoryCode: target.categoryCode,
        sourceUrl: target.url,
      });
    } catch (parseError: unknown) {
      const msg = parseError instanceof Error ? parseError.message : "Parse error";
      return {
        target,
        status: "validation_failed",
        changesCount: 0,
        changes: [],
        snapshotPublished: false,
        preservedPreviousSnapshot: true,
        warnings: [msg],
        errorMessage: msg,
      };
    }

    const validation = validateSnapshotCompleteness(candidateImport, options?.previousSnapshot, target);
    if (!validation.isValid) {
      return {
        target,
        status: "validation_failed",
        courseCount: candidateImport.courses.length,
        sectionCount: candidateImport.sections.length,
        changesCount: 0,
        changes: [],
        snapshotPublished: false,
        preservedPreviousSnapshot: true,
        warnings: validation.warnings,
        errorMessage: validation.failureReason,
      };
    }

    const changes = computeSnapshotDiff(options?.previousSnapshot ?? null, candidateImport);

    if (options?.publish) {
      const store = getSnapshotStore();
      await store.stageSnapshot(categoryCode, candidateImport);
    }

    return {
      target,
      status: "success",
      courseCount: candidateImport.courses.length,
      sectionCount: candidateImport.sections.length,
      changesCount: changes.length,
      changes,
      snapshotPublished: Boolean(options?.publish),
      preservedPreviousSnapshot: true,
      warnings: candidateImport.warnings,
    };
  } finally {
    releaseJobLock(lockKey);
  }
}

/**
 * Complete hourly pipeline:
 * FETCH → PARSE → VALIDATE → COMPARE → STAGE → ATOMIC PUBLISH → VERIFY.
 *
 * Ensures male and female datasets are fetched and validated consistently.
 * If either dataset fails validation or fetch, neither dataset is published,
 * preserving last-known-good state in durable storage.
 */
export async function executeFullPipelineRefresh(options?: {
  maleHtml?: string;
  femaleHtml?: string;
  dryRun?: boolean;
}): Promise<FullPipelineExecutionResult> {
  const executedAt = new Date().toISOString();
  const maleTarget = KFU_BUSINESS_DATASETS["11"];
  const femaleTarget = KFU_BUSINESS_DATASETS["12"];
  const store = getSnapshotStore();

  const lockKey = "kfu-full-pipeline";
  if (!acquireJobLock(lockKey)) {
    return {
      status: "locked",
      executedAt,
      male: {
        target: maleTarget,
        status: "locked",
        changesCount: 0,
        changes: [],
        snapshotPublished: false,
        preservedPreviousSnapshot: true,
        warnings: ["Concurrent execution detected (process lock). Skipping run."],
      },
      female: {
        target: femaleTarget,
        status: "locked",
        changesCount: 0,
        changes: [],
        snapshotPublished: false,
        preservedPreviousSnapshot: true,
        warnings: ["Concurrent execution detected (process lock). Skipping run."],
      },
      errors: ["Concurrent execution detected; skipped to prevent server strain."],
    };
  }

  const distLock = await store.acquireDistributedLock(lockKey, 300000);
  if (!distLock) {
    releaseJobLock(lockKey);
    return {
      status: "locked",
      executedAt,
      male: {
        target: maleTarget,
        status: "locked",
        changesCount: 0,
        changes: [],
        snapshotPublished: false,
        preservedPreviousSnapshot: true,
        warnings: ["Concurrent execution detected (distributed store lock). Skipping run."],
      },
      female: {
        target: femaleTarget,
        status: "locked",
        changesCount: 0,
        changes: [],
        snapshotPublished: false,
        preservedPreviousSnapshot: true,
        warnings: ["Concurrent execution detected (distributed store lock). Skipping run."],
      },
      errors: ["Concurrent execution detected; skipped to prevent server strain."],
    };
  }

  try {
    // 1. FETCH & PARSE MALE
    let maleHtml = options?.maleHtml;
    if (!maleHtml) {
      try {
        maleHtml = await fetchWithPolitePolicy(maleTarget.url);
      } catch (fetchErr: unknown) {
        const errorMsg = fetchErr instanceof Error ? fetchErr.message : "Male source fetch failed";
        await store.releaseDistributedLock(lockKey);
        return {
          status: "fetch_failed",
          executedAt,
          male: {
            target: maleTarget,
            status: "fetch_failed",
            changesCount: 0,
            changes: [],
            snapshotPublished: false,
            preservedPreviousSnapshot: true,
            warnings: [errorMsg],
            errorMessage: errorMsg,
          },
          female: {
            target: femaleTarget,
            status: "skipped_unchanged",
            changesCount: 0,
            changes: [],
            snapshotPublished: false,
            preservedPreviousSnapshot: true,
            warnings: ["Skipped female fetch due to male source fetch failure."],
          },
          errors: [errorMsg],
        };
      }
    }

    let maleCandidate: DataImport;
    try {
      maleCandidate = parseKfuHtml(maleHtml, {
        termId: maleTarget.termId,
        collegeCode: maleTarget.collegeCode,
        categoryCode: maleTarget.categoryCode,
        sourceUrl: maleTarget.url,
      });
    } catch (parseErr: unknown) {
      const errorMsg = parseErr instanceof Error ? parseErr.message : "Male source parse failed";
      return {
        status: "validation_failed",
        executedAt,
        male: {
          target: maleTarget,
          status: "validation_failed",
          changesCount: 0,
          changes: [],
          snapshotPublished: false,
          preservedPreviousSnapshot: true,
          warnings: [errorMsg],
          errorMessage: errorMsg,
        },
        female: {
          target: femaleTarget,
          status: "skipped_unchanged",
          changesCount: 0,
          changes: [],
          snapshotPublished: false,
          preservedPreviousSnapshot: true,
          warnings: ["Skipped female fetch due to male parse failure."],
        },
        errors: [errorMsg],
      };
    }

    if (maleCandidate.courses.length === 0) {
      const titleMatch = maleHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : "Unknown Title";
      const isSharepoint = maleHtml.includes("SharePoint") || maleHtml.includes("Microsoft SharePoint");
      const preview = maleHtml.slice(0, 300).replace(/\s+/g, " ");
      const errorMsg = `Incomplete male snapshot: 0 courses found (HTML length ${maleHtml.length}, title: "${title}", SharePoint: ${isSharepoint}, preview: ${preview})`;
      return {
        status: "validation_failed",
        executedAt,
        male: {
          target: maleTarget,
          status: "validation_failed",
          courseCount: 0,
          sectionCount: 0,
          changesCount: 0,
          changes: [],
          snapshotPublished: false,
          preservedPreviousSnapshot: true,
          warnings: [errorMsg],
          errorMessage: errorMsg,
        },
        female: {
          target: femaleTarget,
          status: "skipped_unchanged",
          changesCount: 0,
          changes: [],
          snapshotPublished: false,
          preservedPreviousSnapshot: true,
          warnings: ["Skipped female fetch due to male 0 courses."],
        },
        errors: [errorMsg],
      };
    }

    // 2. FETCH & PARSE FEMALE
    let femaleHtml = options?.femaleHtml;
    if (!femaleHtml) {
      try {
        femaleHtml = await fetchWithPolitePolicy(femaleTarget.url);
      } catch (fetchErr: unknown) {
        const errorMsg = fetchErr instanceof Error ? fetchErr.message : "Female source fetch failed";
        return {
          status: "fetch_failed",
          executedAt,
          male: {
            target: maleTarget,
            status: "success",
            courseCount: maleCandidate.courses.length,
            sectionCount: maleCandidate.sections.length,
            changesCount: 0,
            changes: [],
            snapshotPublished: false,
            preservedPreviousSnapshot: true,
            warnings: ["Male fetched successfully but publication aborted due to female fetch failure."],
          },
          female: {
            target: femaleTarget,
            status: "fetch_failed",
            changesCount: 0,
            changes: [],
            snapshotPublished: false,
            preservedPreviousSnapshot: true,
            warnings: [errorMsg],
            errorMessage: errorMsg,
          },
          errors: [errorMsg],
        };
      }
    }

    let femaleCandidate: DataImport;
    try {
      femaleCandidate = parseKfuHtml(femaleHtml, {
        termId: femaleTarget.termId,
        collegeCode: femaleTarget.collegeCode,
        categoryCode: femaleTarget.categoryCode,
        sourceUrl: femaleTarget.url,
      });
    } catch (parseErr: unknown) {
      const errorMsg = parseErr instanceof Error ? parseErr.message : "Female source parse failed";
      return {
        status: "validation_failed",
        executedAt,
        male: {
          target: maleTarget,
          status: "success",
          courseCount: maleCandidate.courses.length,
          sectionCount: maleCandidate.sections.length,
          changesCount: 0,
          changes: [],
          snapshotPublished: false,
          preservedPreviousSnapshot: true,
          warnings: ["Male fetched successfully but publication aborted due to female parse failure."],
        },
        female: {
          target: femaleTarget,
          status: "validation_failed",
          changesCount: 0,
          changes: [],
          snapshotPublished: false,
          preservedPreviousSnapshot: true,
          warnings: [errorMsg],
          errorMessage: errorMsg,
        },
        errors: [errorMsg],
      };
    }

    if (femaleCandidate.courses.length === 0) {
      const titleMatch = femaleHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : "Unknown Title";
      const isSharepoint = femaleHtml.includes("SharePoint") || femaleHtml.includes("Microsoft SharePoint");
      const preview = femaleHtml.slice(0, 300).replace(/\s+/g, " ");
      const errorMsg = `Incomplete female snapshot: 0 courses found (HTML length ${femaleHtml.length}, title: "${title}", SharePoint: ${isSharepoint}, preview: ${preview})`;
      return {
        status: "validation_failed",
        executedAt,
        male: {
          target: maleTarget,
          status: "success",
          courseCount: maleCandidate.courses.length,
          sectionCount: maleCandidate.sections.length,
          changesCount: 0,
          changes: [],
          snapshotPublished: false,
          preservedPreviousSnapshot: true,
          warnings: ["Male fetched successfully but publication aborted due to female 0 courses."],
        },
        female: {
          target: femaleTarget,
          status: "validation_failed",
          courseCount: 0,
          sectionCount: 0,
          changesCount: 0,
          changes: [],
          snapshotPublished: false,
          preservedPreviousSnapshot: true,
          warnings: [errorMsg],
          errorMessage: errorMsg,
        },
        errors: [errorMsg],
      };
    }

    // 3. VALIDATE BOTH AGAINST PREVIOUS ACTIVE SNAPSHOTS
    const prevMale = (await store.getActiveSnapshot("11")) ?? maleOfferings;
    const prevFemale = (await store.getActiveSnapshot("12")) ?? femaleOfferings;

    const maleVal = validateSnapshotCompleteness(maleCandidate, prevMale, maleTarget);
    const femaleVal = validateSnapshotCompleteness(femaleCandidate, prevFemale, femaleTarget);

    if (!maleVal.isValid || !femaleVal.isValid) {
      const errors: string[] = [];
      if (!maleVal.isValid && maleVal.failureReason) errors.push(`Male dataset: ${maleVal.failureReason}`);
      if (!femaleVal.isValid && femaleVal.failureReason) errors.push(`Female dataset: ${femaleVal.failureReason}`);

      return {
        status: "validation_failed",
        executedAt,
        male: {
          target: maleTarget,
          status: maleVal.isValid ? "success" : "validation_failed",
          courseCount: maleCandidate.courses.length,
          sectionCount: maleCandidate.sections.length,
          changesCount: 0,
          changes: [],
          snapshotPublished: false,
          preservedPreviousSnapshot: true,
          warnings: maleVal.warnings,
          errorMessage: maleVal.failureReason,
        },
        female: {
          target: femaleTarget,
          status: femaleVal.isValid ? "success" : "validation_failed",
          courseCount: femaleCandidate.courses.length,
          sectionCount: femaleCandidate.sections.length,
          changesCount: 0,
          changes: [],
          snapshotPublished: false,
          preservedPreviousSnapshot: true,
          warnings: femaleVal.warnings,
          errorMessage: femaleVal.failureReason,
        },
        errors,
      };
    }

    // 4. COMPARE: COMPUTE DIFFS
    const maleChanges = computeSnapshotDiff(prevMale, maleCandidate);
    const femaleChanges = computeSnapshotDiff(prevFemale, femaleCandidate);

    if (options?.dryRun) {
      return {
        status: "skipped_unchanged",
        executedAt,
        male: {
          target: maleTarget,
          status: "success",
          courseCount: maleCandidate.courses.length,
          sectionCount: maleCandidate.sections.length,
          changesCount: maleChanges.length,
          changes: maleChanges,
          snapshotPublished: false,
          preservedPreviousSnapshot: true,
          warnings: ["Dry run requested; publication skipped."],
        },
        female: {
          target: femaleTarget,
          status: "success",
          courseCount: femaleCandidate.courses.length,
          sectionCount: femaleCandidate.sections.length,
          changesCount: femaleChanges.length,
          changes: femaleChanges,
          snapshotPublished: false,
          preservedPreviousSnapshot: true,
          warnings: ["Dry run requested; publication skipped."],
        },
      };
    }

    // 5. STAGE BOTH SNAPSHOTS
    await store.stageSnapshot("11", maleCandidate);
    await store.stageSnapshot("12", femaleCandidate);

    // 6. ATOMIC PUBLISH WITH DURABLE STORAGE AND TRUTHFUL METADATA
    const metadata: KfuRefreshMetadata = {
      lastAttemptedCheck: executedAt,
      lastSuccessfulFetchMale: executedAt,
      lastSuccessfulFetchFemale: executedAt,
      lastPublishedMale: maleCandidate.importedAt,
      lastPublishedFemale: femaleCandidate.importedAt,
      lastPublishedSnapshot: executedAt,
      maleCourseCount: maleCandidate.courses.length,
      maleSectionCount: maleCandidate.sections.length,
      femaleCourseCount: femaleCandidate.courses.length,
      femaleSectionCount: femaleCandidate.sections.length,
      sourceHealth: "healthy",
      failureReason: undefined,
      nextExpectedScheduledCheck: new Date(Date.now() + 3600000).toISOString(),
      disclaimer: "Seat availability reflects historical snapshot data and does not guarantee live portal capacity.",
      attestation: KFU_OWNER_ATTESTATION,
    };

    try {
      await store.atomicPublish({
        maleSnapshot: maleCandidate,
        femaleSnapshot: femaleCandidate,
        maleDiff: maleChanges,
        femaleDiff: femaleChanges,
        metadata,
      });
    } catch (publishErr: unknown) {
      const errorMsg = publishErr instanceof Error ? publishErr.message : "Atomic publish transaction failed";
      // Perform automated rollback to previous known-good
      await store.rollbackToPrevious();
      return {
        status: "publish_failed",
        executedAt,
        male: {
          target: maleTarget,
          status: "validation_failed",
          changesCount: 0,
          changes: [],
          snapshotPublished: false,
          preservedPreviousSnapshot: true,
          warnings: [errorMsg, "Automatic rollback executed to preserve previous known-good snapshot."],
          errorMessage: errorMsg,
        },
        female: {
          target: femaleTarget,
          status: "validation_failed",
          changesCount: 0,
          changes: [],
          snapshotPublished: false,
          preservedPreviousSnapshot: true,
          warnings: [errorMsg, "Automatic rollback executed to preserve previous known-good snapshot."],
          errorMessage: errorMsg,
        },
        errors: [errorMsg],
      };
    }

    // 7. VERIFY PUBLISHED SNAPSHOTS IN DURABLE STORAGE
    const verifiedMale = await store.getActiveSnapshot("11");
    const verifiedFemale = await store.getActiveSnapshot("12");

    if (
      !verifiedMale ||
      !verifiedFemale ||
      verifiedMale.courses.length !== maleCandidate.courses.length ||
      verifiedFemale.courses.length !== femaleCandidate.courses.length
    ) {
      await store.rollbackToPrevious();
      return {
        status: "rolled_back",
        executedAt,
        male: {
          target: maleTarget,
          status: "validation_failed",
          changesCount: 0,
          changes: [],
          snapshotPublished: false,
          preservedPreviousSnapshot: true,
          warnings: ["Post-publish verification failed. State was rolled back."],
          errorMessage: "Verification mismatch after publish",
        },
        female: {
          target: femaleTarget,
          status: "validation_failed",
          changesCount: 0,
          changes: [],
          snapshotPublished: false,
          preservedPreviousSnapshot: true,
          warnings: ["Post-publish verification failed. State was rolled back."],
          errorMessage: "Verification mismatch after publish",
        },
        errors: ["Post-publish verification failed; rollback executed."],
      };
    }

    return {
      status: "published",
      executedAt,
      male: {
        target: maleTarget,
        status: "success",
        courseCount: maleCandidate.courses.length,
        sectionCount: maleCandidate.sections.length,
        changesCount: maleChanges.length,
        changes: maleChanges,
        snapshotPublished: true,
        preservedPreviousSnapshot: false,
        warnings: maleCandidate.warnings,
      },
      female: {
        target: femaleTarget,
        status: "success",
        courseCount: femaleCandidate.courses.length,
        sectionCount: femaleCandidate.sections.length,
        changesCount: femaleChanges.length,
        changes: femaleChanges,
        snapshotPublished: true,
        preservedPreviousSnapshot: false,
        warnings: femaleCandidate.warnings,
      },
      metadata,
    };
  } finally {
    releaseJobLock(lockKey);
    await store.releaseDistributedLock(lockKey);
  }
}
