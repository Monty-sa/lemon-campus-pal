import type { Course, DataImport, Day, Section } from "./schema";
import { hasConflictWithSections } from "./schedule";

export type AutoSchedulePreferences = {
  resultCount: 3 | 5 | 10 | 20;
  hardDaysOff: Day[];
  hardEarliestMinutes: number | null;
  hardLatestMinutes: number | null;
  preferredEarliestMinutes: number | null;
  preferredInstructors: string[];
  fewerDays: boolean;
  shorterGaps: boolean;
  openOnly: boolean;
};
export type GeneratedSchedule = { sectionIds: string[]; score: number; reasons: string[] };
export type GenerationResult = { schedules: GeneratedSchedule[]; explored: number; truncated: boolean; hasMore: boolean; warnings: string[] };

export const DEFAULT_AUTO_SCHEDULE_PREFERENCES: AutoSchedulePreferences = {
  resultCount: 5, hardDaysOff: [], hardEarliestMinutes: null, hardLatestMinutes: null,
  preferredEarliestMinutes: 540, preferredInstructors: [], fewerDays: true, shorterGaps: true, openOnly: true,
};
export const AUTO_SCHEDULE_PREFERENCES_KEY = "lemon.auto-schedule-preferences.v1";
export const EARLIEST_TIME_OPTIONS = [540, 600, 660, 720, 780, 840, 900, 960] as const;
export const LATEST_TIME_OPTIONS = [720, 780, 840, 900, 960, 1020, 1080, 1140, 1200] as const;
const MAX_NODES = 100_000;

export function generateSchedules(data: DataImport, courseIds: string[], prefs: AutoSchedulePreferences, offset = 0): GenerationResult {
  const courseMap = new Map(data.courses.map((course) => [course.id, course]));
  const uniqueIds = [...new Set(courseIds)].filter((id) => courseMap.has(id));
  const warnings: string[] = [];
  if (uniqueIds.length !== courseIds.length) warnings.push("Some selected courses were not found in this term/category dataset.");
  const candidates = new Map(uniqueIds.map((id) => {
    const all = data.sections.filter((s) => s.courseId === id && s.termId === data.term.id);
    if (all.some((s) => s.meetings.length === 0)) warnings.push(`Some sections for ${courseMap.get(id)?.code} have no published meeting time and were excluded.`);
    return [id, all.filter((s) => s.meetings.length && (!prefs.openOnly || s.status === "open")
      && !s.meetings.some((m) => m.days.some((d) => prefs.hardDaysOff.includes(d)))
      && (prefs.hardEarliestMinutes === null || s.meetings.every((m) => m.startMinutes >= prefs.hardEarliestMinutes!))
      && (prefs.hardLatestMinutes === null || s.meetings.every((m) => m.endMinutes <= prefs.hardLatestMinutes!)))] as const;
  }));
  const impossible = uniqueIds.filter((id) => !candidates.get(id)?.length);
  if (impossible.length) warnings.push(`No sections satisfy the hard constraints for: ${impossible.map((id) => courseMap.get(id)?.code).join(", ")}.`);
  if (!uniqueIds.length || impossible.length) return { schedules: [], explored: 0, truncated: false, hasMore: false, warnings };

  const ordered = [...uniqueIds].sort((a,b) => candidates.get(a)!.length-candidates.get(b)!.length || a.localeCompare(b));
  const found: GeneratedSchedule[] = []; let explored = 0; let truncated = false; const picked: Section[] = [];
  const visit = (depth: number) => {
    if (explored >= MAX_NODES) { truncated = true; return; }
    if (depth === ordered.length) { explored++; found.push(rank(picked, courseMap, prefs)); return; }
    const sections = candidates.get(ordered[depth])!;
    for (const section of sections) {
      if (hasConflictWithSections(section, picked)) continue;
      picked.push(section); visit(depth+1); picked.pop();
      if (truncated) return;
    }
  };
  visit(0);
  found.sort((a,b) => b.score-a.score || a.sectionIds.join("|").localeCompare(b.sectionIds.join("|")));
  const pageSize = prefs.resultCount;
  const pageStart = Math.max(0, offset);
  return { schedules: found.slice(pageStart, pageStart + pageSize), explored, truncated, hasMore: found.length > pageStart + pageSize, warnings };
}

function rank(sections: Section[], courses: Map<string, Course>, p: AutoSchedulePreferences): GeneratedSchedule {
  let score = 0; const reasons: string[] = []; const days = new Set<Day>(sections.flatMap(s => s.meetings.flatMap(m=>m.days)));
  if (p.fewerDays) { score -= days.size * 10; reasons.push(`${days.size} campus days`); }
  if (p.preferredEarliestMinutes !== null) {
    const earliest = Math.min(...sections.flatMap(s=>s.meetings.map(m=>m.startMinutes)));
    const delta=Math.max(0, earliest-p.preferredEarliestMinutes); score-=delta/30; if (!delta) reasons.push("Preferred start time met");
  }
  if (p.preferredInstructors.length) { const n=sections.filter(s=>p.preferredInstructors.includes(s.instructor?.name??"")).length; score+=n*20; if(n) reasons.push(`${n} preferred instructor match(es)`); }
  if (p.shorterGaps) { let gaps=0; for(const day of days) { const times=sections.flatMap(s=>s.meetings.filter(m=>m.days.includes(day)).map(m=>[m.startMinutes,m.endMinutes] as const)).sort((a,b)=>a[0]-b[0]); for(let i=1;i<times.length;i++) gaps+=Math.max(0,times[i][0]-times[i-1][1]); } score-=gaps/60; reasons.push("Gaps minimized"); }
  score += sections.reduce((n,s)=> n+(s.status==="open"?1:0),0)*0.001;
  return {sectionIds: sections.map(s=>s.id).sort(),score,reasons};
}
