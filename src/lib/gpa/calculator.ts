import type {
  CumulativeGpaResult,
  GpaCourseInput,
  KfuGradeDefinition,
  KfuGradeLetter,
  PreviousGpaRecord,
  SavedGpaScenario,
  SemesterGpaResult,
  TargetFeasibilityResult,
} from "./types";

export const GPA_SCENARIOS_STORAGE_KEY = "lemon.gpa-scenarios.v1";

/**
 * Official KFU 5.0 Grading Scale and Points per University Regulations:
 * https://www.kfu.edu.sa/ar/Deans/AdmissionRecordsDeanship/Documents/acadPlan/rulesAndRegulations_2/definitions.html
 */
export const KFU_GRADE_SCALE: Record<KfuGradeLetter, KfuGradeDefinition> = {
  "A+": { letter: "A+", labelEn: "Exceptional", labelAr: "ممتاز مرتفع", points: 5.0, percentageRange: "95–100", countsInGpa: true },
  "A":  { letter: "A",  labelEn: "Excellent",   labelAr: "ممتاز",        points: 4.75, percentageRange: "90–94", countsInGpa: true },
  "B+": { letter: "B+", labelEn: "Superior",    labelAr: "جيد جداً مرتفع", points: 4.5, percentageRange: "85–89", countsInGpa: true },
  "B":  { letter: "B",  labelEn: "Very Good",   labelAr: "جيد جداً",      points: 4.0, percentageRange: "80–84", countsInGpa: true },
  "C+": { letter: "C+", labelEn: "Above Average", labelAr: "جيد مرتفع",   points: 3.5, percentageRange: "75–79", countsInGpa: true },
  "C":  { letter: "C",  labelEn: "Good",        labelAr: "جيد",          points: 3.0, percentageRange: "70–74", countsInGpa: true },
  "D+": { letter: "D+", labelEn: "High Pass",   labelAr: "مقبول مرتفع",   points: 2.5, percentageRange: "65–69", countsInGpa: true },
  "D":  { letter: "D",  labelEn: "Pass",        labelAr: "مقبول",        points: 2.0, percentageRange: "60–64", countsInGpa: true },
  "F":  { letter: "F",  labelEn: "Fail",        labelAr: "راسب",         points: 1.0, percentageRange: "< 60", countsInGpa: true },
  "DN": { letter: "DN", labelEn: "Denial",      labelAr: "حرمان",        points: 1.0, percentageRange: "Attendance < 75%", countsInGpa: true },
  // Non-GPA grades (excluded from hours and points calculation)
  "NP": { letter: "NP", labelEn: "Pass (No Grade)", labelAr: "ناجح بدون درجات", points: null, percentageRange: "No Grade", countsInGpa: false },
  "NF": { letter: "NF", labelEn: "Fail (No Grade)", labelAr: "راسب بدون درجات", points: null, percentageRange: "No Grade", countsInGpa: false },
  "IC": { letter: "IC", labelEn: "Incomplete",  labelAr: "غير مكتمل",     points: null, percentageRange: "Temporary", countsInGpa: false },
  "IP": { letter: "IP", labelEn: "In Progress", labelAr: "مستمر",        points: null, percentageRange: "Ongoing", countsInGpa: false },
  "W":  { letter: "W",  labelEn: "Withdrawn",   labelAr: "منسحب",        points: null, percentageRange: "Withdrawn", countsInGpa: false },
  "AU": { letter: "AU", labelEn: "Audit",       labelAr: "مستمع",        points: null, percentageRange: "Non-credit", countsInGpa: false },
};

export function getKfuStanding(gpa: number): { standingEn: string; standingAr: string } {
  if (gpa >= 4.5) return { standingEn: "Excellent", standingAr: "ممتاز" };
  if (gpa >= 3.75) return { standingEn: "Very Good", standingAr: "جيد جداً" };
  if (gpa >= 2.75) return { standingEn: "Good", standingAr: "جيد" };
  if (gpa >= 2.0) return { standingEn: "Pass", standingAr: "مقبول" };
  return { standingEn: "Academic Warning", standingAr: "إنذار أكاديمي" };
}

export function roundToTwoDecimals(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates semester GPA based on KFU 5.0 rules.
 * Correctly accounts for non-GPA exclusions and zero credit inputs.
 */
export function calculateSemesterGpa(courses: GpaCourseInput[]): SemesterGpaResult {
  let totalCredits = 0;
  let gpaCredits = 0;
  let qualityPoints = 0;

  for (const course of courses) {
    const credits = Math.max(0, Number(course.credits) || 0);
    totalCredits += credits;

    const def = course.grade ? KFU_GRADE_SCALE[course.grade] : undefined;
    if (def && def.countsInGpa && def.points !== null) {
      gpaCredits += credits;
      qualityPoints += credits * def.points;
    }
  }

  const rawGpa = gpaCredits > 0 ? qualityPoints / gpaCredits : 0;
  const gpa = roundToTwoDecimals(rawGpa);
  const standing = getKfuStanding(gpa);

  return {
    gpa,
    totalCredits,
    gpaCredits,
    qualityPoints: roundToTwoDecimals(qualityPoints),
    academicStandingEn: standing.standingEn,
    academicStandingAr: standing.standingAr,
  };
}

/**
 * Calculates projected cumulative GPA by blending previous academic history with new semester results.
 */
export function calculateProjectedCumulativeGpa(
  previous: PreviousGpaRecord,
  semester: SemesterGpaResult,
): CumulativeGpaResult {
  const prevHours = Math.max(0, Number(previous.previousHours) || 0);
  const prevPoints =
    previous.previousPoints !== undefined && !Number.isNaN(previous.previousPoints)
      ? previous.previousPoints
      : (previous.previousGpa ?? 0) * prevHours;

  const totalHours = prevHours + semester.gpaCredits;
  const totalQualityPoints = prevPoints + semester.qualityPoints;

  const rawCumulative = totalHours > 0 ? totalQualityPoints / totalHours : semester.gpa;
  const cumulativeGpa = roundToTwoDecimals(rawCumulative);

  const prevGpa = prevHours > 0 ? roundToTwoDecimals(prevPoints / prevHours) : 0;
  const gpaChange = prevHours > 0 ? roundToTwoDecimals(cumulativeGpa - prevGpa) : 0;
  const standing = getKfuStanding(cumulativeGpa);

  return {
    cumulativeGpa,
    totalHours,
    totalQualityPoints: roundToTwoDecimals(totalQualityPoints),
    gpaChange,
    academicStandingEn: standing.standingEn,
    academicStandingAr: standing.standingAr,
  };
}

/**
 * Computes whether a target cumulative GPA is achievable in the upcoming semester
 * and what semester GPA is required.
 */
export function calculateTargetGpaFeasibility(
  previous: PreviousGpaRecord,
  semesterCredits: number,
  targetGpa: number,
): TargetFeasibilityResult {
  const prevHours = Math.max(0, Number(previous.previousHours) || 0);
  const prevGpa = previous.previousGpa ?? (prevHours > 0 && previous.previousPoints ? previous.previousPoints / prevHours : 0);
  const prevPoints = previous.previousPoints ?? prevGpa * prevHours;

  if (Number.isNaN(targetGpa) || targetGpa <= 0) {
    return {
      targetGpa: 0,
      requiredSemesterGpa: 0,
      isFeasible: false,
      feasibilityStatus: "impossible",
      messageEn: "Please enter a valid target cumulative GPA between 1.00 and 5.00.",
      messageAr: "يرجى إدخال معدل تراكمي مستهدف صحيح بين 1.00 و 5.00.",
    };
  }

  if (targetGpa > 5.0) {
    return {
      targetGpa,
      requiredSemesterGpa: 5.01,
      isFeasible: false,
      feasibilityStatus: "impossible",
      messageEn: "Mathematically impossible. Maximum cumulative GPA at KFU is 5.00.",
      messageAr: "غير ممكن حسابياً. الحد الأقصى للمعدل التراكمي في جامعة الملك فيصل هو 5.00.",
    };
  }

  if (semesterCredits <= 0) {
    const isMet = prevGpa >= targetGpa;
    return {
      targetGpa,
      requiredSemesterGpa: 0,
      isFeasible: isMet,
      feasibilityStatus: isMet ? "already_met" : "impossible",
      messageEn: isMet ? "Target already achieved with current GPA!" : "Cannot change GPA with 0 semester credit hours.",
      messageAr: isMet ? "تم تحقيق المعدل المستهدف بالفعل!" : "لا يمكن تغيير المعدل بدون ساعات دراسية مسجلة.",
    };
  }

  const totalFutureHours = prevHours + semesterCredits;
  const requiredTotalPoints = targetGpa * totalFutureHours;
  const requiredSemesterPoints = requiredTotalPoints - prevPoints;
  const rawRequiredSemesterGpa = requiredSemesterPoints / semesterCredits;
  const requiredSemesterGpa = roundToTwoDecimals(rawRequiredSemesterGpa);

  if (requiredSemesterGpa > 5.0) {
    return {
      targetGpa,
      requiredSemesterGpa,
      isFeasible: false,
      feasibilityStatus: "impossible",
      messageEn: `Mathematically impossible this semester. Requires a ${requiredSemesterGpa.toFixed(2)} semester GPA (maximum is 5.00).`,
      messageAr: `غير ممكن حسابياً هذا الفصل. يتطلب معدلاً فصلياً قدره ${requiredSemesterGpa.toFixed(2)} (الحد الأقصى هو 5.00).`,
    };
  }

  if (requiredSemesterGpa < 1.0) {
    return {
      targetGpa,
      requiredSemesterGpa: 1.0,
      isFeasible: true,
      feasibilityStatus: "already_met",
      messageEn: "Target easily achievable! Even minimum passing grades will maintain or exceed this target.",
      messageAr: "الهدف مضمون ومتحقق بالفعل مع أي معدل نجاح هذا الفصل.",
    };
  }

  const isDemanding = requiredSemesterGpa >= 4.5;
  return {
    targetGpa,
    requiredSemesterGpa,
    isFeasible: true,
    feasibilityStatus: isDemanding ? "demanding" : "achievable",
    messageEn: isDemanding
      ? `High distinction required: You need at least a ${requiredSemesterGpa.toFixed(2)} semester GPA this term.`
      : `Achievable: You need a ${requiredSemesterGpa.toFixed(2)} semester GPA this term to reach your goal.`,
    messageAr: isDemanding
      ? `يتطلب تفوقاً مرتفعاً: تحتاج إلى معدل فصلي لا يقل عن ${requiredSemesterGpa.toFixed(2)}.`
      : `هدف ممكن وقابل للتحقيق: تحتاج إلى معدل فصلي قدره ${requiredSemesterGpa.toFixed(2)}.`,
  };
}

/**
 * Storage helpers for locally saved scenarios in browser localStorage (Guest-first).
 */
export function loadSavedGpaScenarios(storage: Pick<Storage, "getItem">): SavedGpaScenario[] {
  try {
    const raw = storage.getItem(GPA_SCENARIOS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveGpaScenarios(
  storage: Pick<Storage, "setItem">,
  scenarios: SavedGpaScenario[],
): void {
  try {
    storage.setItem(GPA_SCENARIOS_STORAGE_KEY, JSON.stringify(scenarios.slice(0, 20)));
  } catch {
    // Gracefully handle storage limitations
  }
}
