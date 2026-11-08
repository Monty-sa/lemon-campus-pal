import type { Course, SchedulePlan, Section, SectionMeeting } from "./schema";

export type Conflict = {
  firstSectionId: string;
  secondSectionId: string;
  day: SectionMeeting["days"][number];
  startMinutes: number;
  endMinutes: number;
};

export function meetingsOverlap(first: SectionMeeting, second: SectionMeeting): boolean {
  const sharesDay = first.days.some((day) => second.days.includes(day));
  return sharesDay && first.startMinutes < second.endMinutes && second.startMinutes < first.endMinutes;
}

export function findConflicts(sections: Section[]): Conflict[] {
  const conflicts: Conflict[] = [];
  for (let firstIndex = 0; firstIndex < sections.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < sections.length; secondIndex += 1) {
      const first = sections[firstIndex];
      const second = sections[secondIndex];
      if (first.termId !== second.termId) continue;
      for (const firstMeeting of first.meetings) {
        for (const secondMeeting of second.meetings) {
          if (!meetingsOverlap(firstMeeting, secondMeeting)) continue;
          for (const day of firstMeeting.days.filter((candidate) => secondMeeting.days.includes(candidate))) {
            conflicts.push({
              firstSectionId: first.id,
              secondSectionId: second.id,
              day,
              startMinutes: Math.max(firstMeeting.startMinutes, secondMeeting.startMinutes),
              endMinutes: Math.min(firstMeeting.endMinutes, secondMeeting.endMinutes),
            });
          }
        }
      }
    }
  }
  return conflicts;
}

export function hasConflictWithSections(candidate: Section, currentSections: Section[]): boolean {
  for (const selected of currentSections) {
    if (selected.id === candidate.id) continue;
    if (candidate.termId !== selected.termId) continue;
    for (const cMeeting of candidate.meetings) {
      for (const sMeeting of selected.meetings) {
        if (meetingsOverlap(cMeeting, sMeeting)) return true;
      }
    }
  }
  return false;
}

export function calculateCredits(sections: Section[], courses: Course[]): number {
  const selectedCourseIds = new Set(sections.map((section) => section.courseId));
  return courses.filter((course) => selectedCourseIds.has(course.id)).reduce((sum, course) => sum + course.credits, 0);
}

export function getSectionCategory(section: Section): "11" | "12" | null {
  if (section.provenance?.sourceUrl) {
    if (section.provenance.sourceUrl.includes("p_sex_code=11")) return "11";
    if (section.provenance.sourceUrl.includes("p_sex_code=12")) return "12";
  }
  return null;
}

export function addSectionToPlan(
  plan: SchedulePlan,
  section: Section,
  currentPlanSections?: Section[],
): SchedulePlan {
  if (plan.termId !== section.termId) throw new Error("Cannot add a section from a different semester");
  if (plan.sectionIds.includes(section.id)) return plan;

  // Prevent cross-category section mixing (LEMON-011B)
  if (currentPlanSections && currentPlanSections.length > 0) {
    const newCategory = getSectionCategory(section);
    if (newCategory) {
      const hasConflictCategory = currentPlanSections.some((s) => {
        const existingCategory = getSectionCategory(s);
        return existingCategory !== null && existingCategory !== newCategory;
      });
      if (hasConflictCategory) {
        throw new Error("Cannot mix male and female sections within the same schedule plan");
      }
    }
  }

  return { ...plan, sectionIds: [...plan.sectionIds, section.id], updatedAt: new Date().toISOString() };
}

export function formatTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
