import type { DataImport } from "@/lib/schema";
import type { KfuDatasetTarget, ValidationResult } from "./types";

export const VALIDATION_THRESHOLDS = {
  MIN_COURSES: 50,
  MIN_SECTIONS: 200,
  MAX_SECTION_DROP_RATIO: 0.4, // If section count drops by more than 40%, reject
  MAX_COURSE_DROP_RATIO: 0.3, // If course count drops by more than 30%, reject
  MAX_WARNINGS_RATIO: 0.1, // If warnings exceed 10% of total sections, mark status as "warning"
  EXPECTED_TERM_ID: "144820",
  EXPECTED_COLLEGE_CODE: "06",
};

export function validateSnapshotCompleteness(
  current: DataImport,
  previous?: DataImport | null,
  target?: KfuDatasetTarget,
): ValidationResult {
  const courseCount = current.courses.length;
  const sectionCount = current.sections.length;
  const warnings = [...current.warnings];

  // 1. Term, college, and category validation
  const expectedTerm = target?.termId ?? VALIDATION_THRESHOLDS.EXPECTED_TERM_ID;
  const expectedCollege = target?.collegeCode ?? VALIDATION_THRESHOLDS.EXPECTED_COLLEGE_CODE;

  if (current.term.id !== expectedTerm) {
    return {
      isValid: false,
      status: "invalid",
      courseCount,
      sectionCount,
      warnings,
      failureReason: `Term mismatch: expected term "${expectedTerm}", but received "${current.term.id}".`,
    };
  }

  if (current.college.id !== expectedCollege) {
    return {
      isValid: false,
      status: "invalid",
      courseCount,
      sectionCount,
      warnings,
      failureReason: `College mismatch: expected college "${expectedCollege}", but received "${current.college.id}".`,
    };
  }

  if (target?.categoryCode && current.studentCategory?.id !== target.categoryCode) {
    return {
      isValid: false,
      status: "invalid",
      courseCount,
      sectionCount,
      warnings,
      failureReason: `Category separation failure: expected gender category "${target.categoryCode}" (${target.categoryLabelEn}), but received "${current.studentCategory?.id ?? "unspecified"}".`,
    };
  }

  // 2. Minimum count thresholds
  if (courseCount < VALIDATION_THRESHOLDS.MIN_COURSES) {
    return {
      isValid: false,
      status: "invalid",
      courseCount,
      sectionCount,
      warnings,
      failureReason: `Incomplete snapshot: only ${courseCount} courses found (minimum required: ${VALIDATION_THRESHOLDS.MIN_COURSES}).`,
    };
  }

  if (sectionCount < VALIDATION_THRESHOLDS.MIN_SECTIONS) {
    return {
      isValid: false,
      status: "invalid",
      courseCount,
      sectionCount,
      warnings,
      failureReason: `Incomplete snapshot: only ${sectionCount} sections found (minimum required: ${VALIDATION_THRESHOLDS.MIN_SECTIONS}).`,
    };
  }

  // 3. Unique section identities (detect duplicate CRNs)
  const seenCrns = new Set<string>();
  for (const section of current.sections) {
    if (!section.crn || seenCrns.has(section.crn)) {
      return {
        isValid: false,
        status: "invalid",
        courseCount,
        sectionCount,
        warnings,
        failureReason: `Duplicate CRN detected: section CRN "${section.crn || "empty"}" appears multiple times in the dataset.`,
      };
    }
    seenCrns.add(section.crn);
  }

  // 4. Course validation and section reference integrity
  const courseIdSet = new Set<string>();
  for (const course of current.courses) {
    if (!course.code || !course.titleAr || typeof course.credits !== "number" || course.credits < 0) {
      return {
        isValid: false,
        status: "invalid",
        courseCount,
        sectionCount,
        warnings,
        failureReason: `Malformed course record: course "${course.code || "unknown"}" has missing title or invalid credits.`,
      };
    }
    courseIdSet.add(course.id);
  }

  for (const section of current.sections) {
    if (!courseIdSet.has(section.courseId)) {
      return {
        isValid: false,
        status: "invalid",
        courseCount,
        sectionCount,
        warnings,
        failureReason: `Orphan section detected: CRN ${section.crn} references non-existent courseId "${section.courseId}".`,
      };
    }

    for (const meeting of section.meetings) {
      if (meeting.startMinutes >= meeting.endMinutes || meeting.days.length === 0) {
        return {
          isValid: false,
          status: "invalid",
          courseCount,
          sectionCount,
          warnings,
          failureReason: `Malformed meeting schedule in CRN ${section.crn}: invalid time range (${meeting.startMinutes} - ${meeting.endMinutes}) or empty days.`,
        };
      }
    }
  }

  // 5. Prevent partial scrape truncation if previous known-good snapshot exists
  if (previous && previous.sections.length > 0) {
    const prevSectionCount = previous.sections.length;
    const drop = (prevSectionCount - sectionCount) / prevSectionCount;
    if (drop > VALIDATION_THRESHOLDS.MAX_SECTION_DROP_RATIO) {
      return {
        isValid: false,
        status: "invalid",
        courseCount,
        sectionCount,
        warnings,
        failureReason: `Suspicious data drop: section count plummeted by ${(drop * 100).toFixed(1)}% (${prevSectionCount} -> ${sectionCount}). Potential KFU server truncation.`,
      };
    }

    if (previous.courses.length > 0) {
      const prevCourseCount = previous.courses.length;
      const courseDrop = (prevCourseCount - courseCount) / prevCourseCount;
      if (courseDrop > VALIDATION_THRESHOLDS.MAX_COURSE_DROP_RATIO) {
        return {
          isValid: false,
          status: "invalid",
          courseCount,
          sectionCount,
          warnings,
          failureReason: `Suspicious course drop: course count plummeted by ${(courseDrop * 100).toFixed(1)}% (${prevCourseCount} -> ${courseCount}). Potential KFU server truncation.`,
        };
      }
    }
  }

  // 6. Status determination
  const status: "valid" | "warning" =
    warnings.length > sectionCount * VALIDATION_THRESHOLDS.MAX_WARNINGS_RATIO || warnings.length > 5
      ? "warning"
      : "valid";

  return {
    isValid: true,
    status,
    courseCount,
    sectionCount,
    warnings,
  };
}
