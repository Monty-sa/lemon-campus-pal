import { createHash } from "node:crypto";
import { DataImportSchema, type DataImport, type Day, type SectionMeeting } from "./schema";

export type ImportOptions = { termId: string; collegeCode: string; categoryCode: string; sourceUrl: string; importedAt?: string };

const dayMap: Record<string, Day> = { ح: "sun", ن: "mon", ث: "tue", ر: "wed", خ: "thu", ج: "fri", س: "sat" };
const verifiedTerms: Record<string, string> = { "144820": "الفصل الدراسي الثاني للعام الجامعي 1448" };
const verifiedColleges: Record<string, string> = { "06": "كلية إدارة الأعمال" };
const verifiedCategories: Record<string, string> = { "11": "طلاب", "12": "طالبات" };

const decode = (value: string) => value
  .replace(/<[^>]+>/g, " ")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/g, "&")
  .replace(/\s+/g, " ")
  .trim();

const toMinutes = (value: string): number | null => {
  const match = value.match(/^(\d{1,2})(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : null;
};

function parseMeeting(crn: string, rowIndex: number, daysValue: string, timeValue: string, activity: string): SectionMeeting | null {
  const time = timeValue.match(/(\d{3,4})\s*-\s*(\d{3,4})/);
  if (!time) return null;
  const startMinutes = toMinutes(time[1]);
  const endMinutes = toMinutes(time[2]);
  const days = daysValue.split(/\s+/).map((value) => dayMap[value]).filter((day): day is Day => Boolean(day));
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes || days.length === 0) return null;
  return { id: `${crn}-${rowIndex}`, days, startMinutes, endMinutes, activity: activity || undefined };
}

export function parseKfuHtml(html: string, options: ImportOptions): DataImport {
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((row) => [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => decode(cell[1])))
    .filter((cells) => cells.length >= 13 && /^\d{4}-\d+/.test(cells[0] ?? ""));
  const warnings: string[] = [];
  const byCrn = new Map<string, { cells: string[]; meetings: SectionMeeting[] }>();

  rows.forEach((cells, rowIndex) => {
    const [, crn, , , , , days, activity, time] = cells;
    const meeting = parseMeeting(crn, rowIndex, days, time, activity);
    if (!meeting) warnings.push(`Could not parse the meeting time for CRN ${crn}: ${days} ${time}`);
    const current = byCrn.get(crn);
    if (current) {
      if (meeting) current.meetings.push(meeting);
    } else {
      byCrn.set(crn, { cells, meetings: meeting ? [meeting] : [] });
    }
  });

  const importedAt = options.importedAt ?? new Date().toISOString();
  const coursesByCode = new Map<string, { id: string; termId: string; departmentId?: string; code: string; titleAr: string; credits: number }>();
  const provenance = { sourceUrl: options.sourceUrl, importedAt, sourceLabel: "نظام الجداول العام بجامعة الملك فيصل", rawHash: createHash("sha256").update(html).digest("hex") };
  const sections = [...byCrn.entries()].flatMap(([crn, { cells, meetings }]) => {
    const [code, , sectionCode, availability, titleAr, credits, , activity, , instructor, prerequisites, colleges, majors] = cells;
    const creditsNumber = Number(credits);
    if (!code || !crn || !sectionCode || !titleAr || !Number.isFinite(creditsNumber)) {
      warnings.push(`Skipped an incomplete row for section ${crn || "unknown"}`);
      return [];
    }
    const courseId = `${options.termId}:${code}`;
    coursesByCode.set(code, { id: courseId, termId: options.termId, departmentId: code.split("-")[0], code, titleAr, credits: creditsNumber });
    return [{
      id: `${options.termId}:${crn}`,
      termId: options.termId,
      courseId,
      crn,
      sectionCode,
      status: availability.includes("غير") ? "closed" as const : availability.includes("متاح") ? "open" as const : "unknown" as const,
      instructionalFormat: activity || undefined,
      instructor: instructor ? { id: instructor.replace(/\s+/g, "-"), name: instructor } : undefined,
      meetings,
      linkedSectionIds: [],
      restrictions: {
        prerequisites: prerequisites || undefined,
        colleges: colleges ? colleges.split(/\s+/) : [],
        majors: majors ? majors.split(/\s+/) : [],
      },
      provenance,
    }];
  });

  return DataImportSchema.parse({
    id: `kfu-${options.termId}-${options.collegeCode}-${options.categoryCode}-${importedAt}`,
    term: { id: options.termId, labelAr: verifiedTerms[options.termId] ?? `الفصل ذو الرمز ${options.termId}` },
    college: { id: options.collegeCode, nameAr: verifiedColleges[options.collegeCode] ?? `الكلية ذات الرمز ${options.collegeCode}` },
    studentCategory: { id: options.categoryCode, labelAr: verifiedCategories[options.categoryCode] ?? `الفئة ذات الرمز ${options.categoryCode}` },
    importedAt,
    sourceUrl: options.sourceUrl,
    sourceLabel: "نظام الجداول العام بجامعة الملك فيصل",
    status: "verified-snapshot",
    courses: [...coursesByCode.values()],
    sections,
    warnings,
  });
}
