export type KfuGradeLetter =
  | "A+"
  | "A"
  | "B+"
  | "B"
  | "C+"
  | "C"
  | "D+"
  | "D"
  | "F"
  | "DN"
  | "NP"
  | "NF"
  | "IC"
  | "IP"
  | "W"
  | "AU";

export interface KfuGradeDefinition {
  letter: KfuGradeLetter;
  labelEn: string;
  labelAr: string;
  points: number | null;
  percentageRange: string;
  countsInGpa: boolean;
}

export interface GpaCourseInput {
  id: string;
  code: string;
  title?: string;
  credits: number;
  grade: KfuGradeLetter | "";
  isRepeat?: boolean;
}

export interface SemesterGpaResult {
  gpa: number;
  totalCredits: number;
  gpaCredits: number;
  qualityPoints: number;
  academicStandingEn: string;
  academicStandingAr: string;
}

export interface PreviousGpaRecord {
  previousGpa?: number;
  previousHours: number;
  previousPoints?: number;
}

export interface CumulativeGpaResult {
  cumulativeGpa: number;
  totalHours: number;
  totalQualityPoints: number;
  gpaChange: number;
  academicStandingEn: string;
  academicStandingAr: string;
}

export interface TargetFeasibilityResult {
  targetGpa: number;
  requiredSemesterGpa: number;
  isFeasible: boolean;
  feasibilityStatus: "achievable" | "demanding" | "impossible" | "already_met";
  messageEn: string;
  messageAr: string;
}

export interface SavedGpaScenario {
  id: string;
  name: string;
  previousGpa: number;
  previousHours: number;
  courses: GpaCourseInput[];
  updatedAt: string;
}
