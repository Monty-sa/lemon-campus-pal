import type { DataImport } from "../schema";

export type KfuGenderCategory = "11" | "12";

export interface KfuDatasetTarget {
  termId: string;
  collegeCode: string;
  categoryCode: KfuGenderCategory;
  categoryLabelEn: string;
  categoryLabelAr: string;
  url: string;
}

export const KFU_BUSINESS_DATASETS: Record<KfuGenderCategory, KfuDatasetTarget> = {
  "11": {
    termId: "144820",
    collegeCode: "06",
    categoryCode: "11",
    categoryLabelEn: "Male students",
    categoryLabelAr: "طلاب",
    url: "https://ssb-ar.kfu.edu.sa/PROD_ar/ws?p_trm_code=144820&p_col_code=06&p_sex_code=11",
  },
  "12": {
    termId: "144820",
    collegeCode: "06",
    categoryCode: "12",
    categoryLabelEn: "Female students",
    categoryLabelAr: "طالبات",
    url: "https://ssb-ar.kfu.edu.sa/PROD_ar/ws?p_trm_code=144820&p_col_code=06&p_sex_code=12",
  },
};

export type SectionChangeType =
  | "added"
  | "cancelled"
  | "availability_changed"
  | "schedule_changed"
  | "instructor_changed";

export interface SectionChange {
  termId: string;
  categoryCode: KfuGenderCategory;
  crn: string;
  courseCode: string;
  changeType: SectionChangeType;
  summary: string;
  oldVal?: Record<string, unknown>;
  newVal?: Record<string, unknown>;
  detectedAt: string;
}

export interface ValidationResult {
  isValid: boolean;
  status: "valid" | "warning" | "invalid";
  courseCount: number;
  sectionCount: number;
  warnings: string[];
  failureReason?: string;
}

export interface SnapshotFreshnessInfo {
  importedAt: string;
  lastCheckedAt?: string;
  lastUpdatedAt?: string;
  isStale: boolean;
  freshnessLabel: "Fresh" | "Aging" | "Stale";
  relativeAgeLabel: string;
}

export interface PipelineExecutionResult {
  target: KfuDatasetTarget;
  status: "success" | "skipped_unchanged" | "validation_failed" | "fetch_failed" | "locked";
  courseCount?: number;
  sectionCount?: number;
  changesCount: number;
  changes: SectionChange[];
  snapshotPublished: boolean;
  preservedPreviousSnapshot: boolean;
  warnings: string[];
  errorMessage?: string;
}

export const KFU_OWNER_ATTESTATION =
  "Owner attestation: full university authorization confirmed for automated collection and republication (LEMON-038/LEMON-039).";

export interface KfuRefreshMetadata {
  lastAttemptedCheck: string;
  lastSuccessfulFetchMale?: string;
  lastSuccessfulFetchFemale?: string;
  lastPublishedMale?: string;
  lastPublishedFemale?: string;
  lastPublishedSnapshot?: string;
  maleCourseCount?: number;
  maleSectionCount?: number;
  femaleCourseCount?: number;
  femaleSectionCount?: number;
  sourceHealth: "healthy" | "degraded" | "failing";
  failureReason?: string;
  nextExpectedScheduledCheck?: string;
  refreshSource?: "windows_worker" | "cloud_function" | "bundled_baseline";
  activeVersion?: string;
  disclaimer: string;
  attestation: string;
}

export interface ActiveVersionPointer {
  version: string;
  publishedAt: string;
  maleCourseCount: number;
  maleSectionCount: number;
  femaleCourseCount: number;
  femaleSectionCount: number;
}

export interface KfuIngestPayload {
  maleSnapshot: DataImport;
  femaleSnapshot: DataImport;
  sourceMetadata: {
    fetchedAt: string;
    workerVersion: string;
    workerHost?: string;
  };
}

export interface KfuIngestResponse {
  status: "published" | "unchanged" | "rejected";
  version: string;
  publishedAt: string;
  male: {
    courseCount: number;
    sectionCount: number;
    changesCount: number;
  };
  female: {
    courseCount: number;
    sectionCount: number;
    changesCount: number;
  };
  metadata: KfuRefreshMetadata;
}

export interface FullPipelineExecutionResult {
  status:
    | "published"
    | "skipped_unchanged"
    | "validation_failed"
    | "fetch_failed"
    | "locked"
    | "publish_failed"
    | "rolled_back";
  executedAt: string;
  male: PipelineExecutionResult;
  female: PipelineExecutionResult;
  metadata?: KfuRefreshMetadata;
  errors?: string[];
}
