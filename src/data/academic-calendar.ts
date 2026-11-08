/**
 * Verified King Faisal University Academic Calendar Data (1448 AH)
 * Official Source: https://www.kfu.edu.sa/ar/Deans/AdmissionRecordsDeanship/Pages/academiScedule1.aspx
 * Source Iframe Data: /Documents/acadPlan/calender48/data.js
 * Verified At: 2026-11-08T18:40:00Z
 */

export interface AcademicCalendarEvent {
  id: string;
  titleAr: string;
  titleEn: string;
  category: "registration" | "exam" | "break" | "general";
  startDate: string; // ISO Date YYYY-MM-DD in Asia/Riyadh
  endDate: string; // ISO Date YYYY-MM-DD in Asia/Riyadh
  startHijri?: string;
  endHijri?: string;
  semester: "1" | "2" | "year";
  academicYear: string;
  sourceUrl: string;
  verifiedAt: string;
  cohortRestrictions?: string;
}

export const KFU_OFFICIAL_CALENDAR_URL =
  "https://www.kfu.edu.sa/ar/Deans/AdmissionRecordsDeanship/Pages/academiScedule1.aspx";

export const VERIFIED_ACADEMIC_EVENTS_1448: AcademicCalendarEvent[] = [
  {
    id: "kfu-1448-early-reg-s2",
    titleAr: "التسجيل المبكر لمقررات الفصل الدراسي الثاني 1448هـ",
    titleEn: "Early Registration for Second Semester 1448 AH",
    category: "registration",
    startDate: "2026-11-08",
    endDate: "2026-11-19",
    startHijri: "1448/05/28",
    endHijri: "1448/06/09",
    semester: "2",
    academicYear: "1448",
    sourceUrl: KFU_OFFICIAL_CALENDAR_URL,
    verifiedAt: "2026-11-08T18:40:00Z",
  },
  {
    id: "kfu-1448-reg-problems-s2",
    titleAr: "تفعيل خدمة طلب حل مشاكل التسجيل للفصل الدراسي الثاني 1448هـ",
    titleEn: "Registration Problem Resolution Service (Second Semester 1448 AH)",
    category: "registration",
    startDate: "2026-11-12",
    endDate: "2026-11-14",
    startHijri: "1448/06/02",
    endHijri: "1448/06/04",
    semester: "2",
    academicYear: "1448",
    sourceUrl: KFU_OFFICIAL_CALENDAR_URL,
    verifiedAt: "2026-11-08T18:40:00Z",
  },
  {
    id: "kfu-1448-autumn-break",
    titleAr: "إجازة الخريف للعام الجامعي 1448هـ",
    titleEn: "Autumn Break 1448 AH",
    category: "break",
    startDate: "2026-11-20",
    endDate: "2026-11-28",
    startHijri: "1448/06/10",
    endHijri: "1448/06/18",
    semester: "1",
    academicYear: "1448",
    sourceUrl: KFU_OFFICIAL_CALENDAR_URL,
    verifiedAt: "2026-11-08T18:40:00Z",
  },
  {
    id: "kfu-1448-final-excuses-s1",
    titleAr: "استقبال أعذار غياب الطلبة عن الاختبارات النهائية للفصل الأول 1448هـ",
    titleEn: "Submission of Absence Excuses for Final Examinations (First Semester 1448 AH)",
    category: "exam",
    startDate: "2026-12-20",
    endDate: "2027-01-11",
    startHijri: "1448/07/11",
    endHijri: "1448/08/03",
    semester: "1",
    academicYear: "1448",
    sourceUrl: KFU_OFFICIAL_CALENDAR_URL,
    verifiedAt: "2026-11-08T18:40:00Z",
  },
  {
    id: "kfu-1448-final-exams-s1",
    titleAr: "فترة إجراء الاختبارات النهائية للفصل الدراسي الأول 1448هـ",
    titleEn: "Final Examinations Period for First Semester 1448 AH",
    category: "exam",
    startDate: "2026-12-27",
    endDate: "2027-01-07",
    startHijri: "1448/07/18",
    endHijri: "1448/07/29",
    semester: "1",
    academicYear: "1448",
    sourceUrl: KFU_OFFICIAL_CALENDAR_URL,
    verifiedAt: "2026-11-08T18:40:00Z",
  },
  {
    id: "kfu-1448-grad-certificates-s1",
    titleAr: "تفعيل خدمة استخراج شهادة مؤقتة لخريجي الفصل الأول 1448هـ",
    titleEn: "Temporary Graduation Certificates Service (First Semester 1448 AH)",
    category: "general",
    startDate: "2027-01-14",
    endDate: "2027-02-07",
    startHijri: "1448/08/06",
    endHijri: "1448/08/30",
    semester: "1",
    academicYear: "1448",
    sourceUrl: KFU_OFFICIAL_CALENDAR_URL,
    verifiedAt: "2026-11-08T18:40:00Z",
  },
];
