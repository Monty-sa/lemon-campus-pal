import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import type { Day, Section } from "../src/lib/schema";

type RawMeeting = { days: Day[]; startMinutes: number; endMinutes: number; activity?: string };
type RawSection = {
  crn: string;
  courseCode: string;
  courseTitle: string;
  credits: number;
  sectionCode: string;
  status: "open" | "closed" | "unknown";
  instructor?: string;
  activity?: string;
  meetings: RawMeeting[];
};

type EvidenceRow = {
  crn: string;
  traits: string[];
  raw: RawSection;
  normalized: RawSection | null;
  fieldResults: Record<string, boolean>;
  pass: boolean;
};

const sourceUrl = "https://ssb-ar.kfu.edu.sa/PROD_ar/ws?p_trm_code=144820&p_col_code=06&p_sex_code=11";
const snapshotPath = "data/kfu-144820-06-11.json";
const outputPath = "data/validation-evidence.json";
const dayMap: Record<string, Day> = { ح: "sun", ن: "mon", ث: "tue", ر: "wed", خ: "thu", ج: "fri", س: "sat" };

const decode = (value: string) => value
  .replace(/<[^>]+>/g, " ")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/g, "&")
  .replace(/\s+/g, " ")
  .trim();

const minutes = (value: string) => {
  const match = value.match(/^(\d{1,2})(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

function rawSectionsFromHtml(html: string): Map<string, RawSection> {
  const records = new Map<string, RawSection>();
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((row) => [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => decode(cell[1])))
    .filter((cells) => cells.length >= 13 && /^\d{4}-\d+/.test(cells[0] ?? ""));

  for (const cells of rows) {
    const [courseCode, crn, sectionCode, availability, courseTitle, credits, daysValue, activity, time, instructor] = cells;
    const timeMatch = time.match(/(\d{3,4})\s*-\s*(\d{3,4})/);
    const startMinutes = timeMatch ? minutes(timeMatch[1]) : null;
    const endMinutes = timeMatch ? minutes(timeMatch[2]) : null;
    const days = daysValue.split(/\s+/).map((day) => dayMap[day]).filter((day): day is Day => Boolean(day));
    const meeting = startMinutes !== null && endMinutes !== null && endMinutes > startMinutes && days.length
      ? { days, startMinutes, endMinutes, activity: activity || undefined }
      : null;
    const current = records.get(crn);
    if (current) {
      if (meeting) current.meetings.push(meeting);
      continue;
    }
    records.set(crn, {
      crn,
      courseCode,
      courseTitle,
      credits: Number(credits),
      sectionCode,
      status: availability.includes("غير") ? "closed" : availability.includes("متاح") ? "open" : "unknown",
      instructor: instructor || undefined,
      activity: activity || undefined,
      meetings: meeting ? [meeting] : [],
    });
  }
  return records;
}

function normalizedRecord(section: Section, courses: Map<string, { code: string; titleAr: string; credits: number }>): RawSection {
  const course = courses.get(section.courseId);
  if (!course) throw new Error(`Missing course ${section.courseId}`);
  return {
    crn: section.crn,
    courseCode: course.code,
    courseTitle: course.titleAr,
    credits: course.credits,
    sectionCode: section.sectionCode,
    status: section.status,
    instructor: section.instructor?.name,
    activity: section.instructionalFormat,
    meetings: section.meetings.map(({ days, startMinutes, endMinutes, activity }) => ({ days, startMinutes, endMinutes, activity })),
  };
}

const stable = (value: unknown) => JSON.stringify(value);
const traitsFor = (section: RawSection) => [
  section.meetings.length > 1 ? "multiple-meetings" : section.meetings.length === 0 ? "missing-meeting" : "single-meeting",
  section.instructor ? "named-instructor" : "missing-instructor",
  `status-${section.status}`,
  section.activity === "نظري" ? "activity-theory" : `activity-${section.activity ?? "missing"}`,
];

function chooseSample(sections: RawSection[], size = 30): RawSection[] {
  const selected = new Map<string, RawSection>();
  const take = (predicate: (section: RawSection) => boolean, count: number) => {
    for (const section of sections.filter(predicate)) {
      if (selected.size >= size || count <= 0) break;
      if (!selected.has(section.crn)) {
        selected.set(section.crn, section);
        count -= 1;
      }
    }
  };
  take((section) => section.activity !== "نظري", 3);
  take((section) => section.meetings.length === 0, 3);
  take((section) => section.meetings.length > 1 && section.status === "open" && !section.instructor, 5);
  take((section) => section.meetings.length > 1 && section.status === "closed", 5);
  take((section) => section.meetings.length > 1 && Boolean(section.instructor), 5);
  take((section) => section.meetings.length === 1 && section.status === "open" && Boolean(section.instructor), 5);
  take((section) => section.meetings.length === 1 && section.status === "closed" && !section.instructor, 5);
  take(() => true, size);
  return [...selected.values()].slice(0, size);
}

const response = await fetch(sourceUrl, {
  redirect: "follow",
  headers: { "user-agent": "LEMON-KFU-Planner/0.1 (student prototype; one-time read-only validation)" },
});
if (!response.ok) throw new Error(`Source request failed: HTTP ${response.status}`);
const html = await response.text();
const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
const rawByCrn = rawSectionsFromHtml(html);
const courses = new Map<string, { code: string; titleAr: string; credits: number }>(snapshot.courses.map((course: { id: string; code: string; titleAr: string; credits: number }) => [course.id, course]));
const normalizedByCrn = new Map<string, RawSection>(snapshot.sections.map((section: Section) => [section.crn, normalizedRecord(section, courses)]));

function compare(raw: RawSection, normalized: RawSection | null): EvidenceRow {
  const fieldResults = {
    crn: raw.crn === normalized?.crn,
    courseCode: raw.courseCode === normalized?.courseCode,
    courseTitle: raw.courseTitle === normalized?.courseTitle,
    credits: raw.credits === normalized?.credits,
    sectionCode: raw.sectionCode === normalized?.sectionCode,
    status: raw.status === normalized?.status,
    instructor: raw.instructor === normalized?.instructor,
    activity: raw.activity === normalized?.activity,
    meetings: stable(raw.meetings) === stable(normalized?.meetings),
  };
  return { crn: raw.crn, traits: traitsFor(raw), raw, normalized, fieldResults, pass: Object.values(fieldResults).every(Boolean) };
}

const allComparisons = [...rawByCrn.values()].map((raw) => compare(raw, normalizedByCrn.get(raw.crn) ?? null));
const sample = chooseSample([...rawByCrn.values()]).map((raw) => compare(raw, normalizedByCrn.get(raw.crn) ?? null));
const evidence = {
  generatedAt: new Date().toISOString(),
  request: {
    sourceUrl,
    status: response.status,
    finalUrl: response.url,
    contentType: response.headers.get("content-type"),
    htmlBytes: Buffer.byteLength(html),
    htmlSha256: createHash("sha256").update(html).digest("hex"),
  },
  snapshot: { path: snapshotPath, importedAt: snapshot.importedAt, courses: snapshot.courses.length, sections: snapshot.sections.length },
  live: { rawRows: [...html.matchAll(/<tr\b/gi)].length, sections: rawByCrn.size },
  fullComparison: {
    compared: allComparisons.length,
    passed: allComparisons.filter((row) => row.pass).length,
    mismatches: allComparisons.filter((row) => !row.pass),
    snapshotOnlyCrns: [...normalizedByCrn.keys()].filter((crn) => !rawByCrn.has(crn)),
  },
  sample: {
    size: sample.length,
    passed: sample.filter((row) => row.pass).length,
    traitCounts: Object.fromEntries([...new Set(sample.flatMap((row) => row.traits))].map((trait) => [trait, sample.filter((row) => row.traits.includes(trait)).length])),
    rows: sample,
  },
};

await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ outputPath, fullComparison: evidence.fullComparison, sample: { size: evidence.sample.size, passed: evidence.sample.passed, traitCounts: evidence.sample.traitCounts } }, null, 2));
