import type { DataImport, Section } from "@/lib/schema";
import type { KfuGenderCategory, SectionChange } from "./types";

function meetingsMatch(aMeetings: Section["meetings"], bMeetings: Section["meetings"]): boolean {
  if (aMeetings.length !== bMeetings.length) return false;
  for (let i = 0; i < aMeetings.length; i += 1) {
    const a = aMeetings[i];
    const b = bMeetings[i];
    if (a.startMinutes !== b.startMinutes || a.endMinutes !== b.endMinutes) return false;
    const aDays = [...a.days].sort().join(",");
    const bDays = [...b.days].sort().join(",");
    if (aDays !== bDays) return false;
  }
  return true;
}

export function computeSnapshotDiff(
  previous: DataImport | null,
  current: DataImport,
  detectedAt = new Date().toISOString(),
): SectionChange[] {
  const changes: SectionChange[] = [];
  const termId = current.term.id;
  const categoryCode = (current.studentCategory?.id as KfuGenderCategory) ?? "11";

  if (!previous) {
    return changes;
  }

  const prevByCrn = new Map<string, Section>();
  for (const section of previous.sections) {
    prevByCrn.set(section.crn, section);
  }

  const currentByCrn = new Map<string, Section>();
  for (const section of current.sections) {
    currentByCrn.set(section.crn, section);
  }

  // 1. Detect added sections & modifications
  for (const [crn, section] of currentByCrn.entries()) {
    const prev = prevByCrn.get(crn);
    const course = current.courses.find((c) => c.id === section.courseId);
    const courseCode = course?.code ?? section.courseId;

    if (!prev) {
      changes.push({
        termId,
        categoryCode,
        crn,
        courseCode,
        changeType: "added",
        summary: `Section ${section.sectionCode} (CRN ${crn}) was added to the course catalog.`,
        newVal: {
          sectionCode: section.sectionCode,
          status: section.status,
          instructor: section.instructor?.name,
        },
        detectedAt,
      });
      continue;
    }

    // Availability change
    if (prev.status !== section.status) {
      changes.push({
        termId,
        categoryCode,
        crn,
        courseCode,
        changeType: "availability_changed",
        summary: `CRN ${crn} status changed from ${prev.status} to ${section.status}.`,
        oldVal: { status: prev.status },
        newVal: { status: section.status },
        detectedAt,
      });
    }

    // Timetable / meeting time change
    if (!meetingsMatch(prev.meetings, section.meetings)) {
      changes.push({
        termId,
        categoryCode,
        crn,
        courseCode,
        changeType: "schedule_changed",
        summary: `CRN ${crn} meeting schedule was updated.`,
        oldVal: { meetings: prev.meetings },
        newVal: { meetings: section.meetings },
        detectedAt,
      });
    }

    // Instructor change
    const prevInstructor = prev.instructor?.name ?? "";
    const currentInstructor = section.instructor?.name ?? "";
    if (prevInstructor !== currentInstructor) {
      changes.push({
        termId,
        categoryCode,
        crn,
        courseCode,
        changeType: "instructor_changed",
        summary: `CRN ${crn} instructor changed from ${prevInstructor || "None"} to ${currentInstructor || "None"}.`,
        oldVal: { instructor: prevInstructor },
        newVal: { instructor: currentInstructor },
        detectedAt,
      });
    }
  }

  // 2. Detect cancelled sections (present in previous but absent in current)
  for (const [crn, prevSection] of prevByCrn.entries()) {
    if (!currentByCrn.has(crn)) {
      const course = previous.courses.find((c) => c.id === prevSection.courseId);
      const courseCode = course?.code ?? prevSection.courseId;

      changes.push({
        termId,
        categoryCode,
        crn,
        courseCode,
        changeType: "cancelled",
        summary: `CRN ${crn} (${courseCode} section ${prevSection.sectionCode}) is no longer offered.`,
        oldVal: {
          sectionCode: prevSection.sectionCode,
          status: prevSection.status,
        },
        detectedAt,
      });
    }
  }

  return changes;
}
