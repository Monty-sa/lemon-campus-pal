import { z } from "zod";

export const DaySchema = z.enum(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]);
export type Day = z.infer<typeof DaySchema>;

export const AcademicTermSchema = z.object({
  id: z.string().min(1),
  labelAr: z.string().min(1),
  labelEn: z.string().optional(),
  startsOn: z.string().optional(),
  endsOn: z.string().optional(),
});

export const CollegeSchema = z.object({ id: z.string().min(1), nameAr: z.string().min(1), nameEn: z.string().optional() });
export const StudentCategorySchema = z.object({ id: z.string().min(1), labelAr: z.string().min(1), labelEn: z.string().optional() });
export const DepartmentSchema = z.object({ id: z.string().min(1), collegeId: z.string().min(1), nameAr: z.string().min(1) });
export const InstructorSchema = z.object({ id: z.string().min(1), name: z.string().min(1) });

export const SectionMeetingSchema = z.object({
  id: z.string().min(1),
  days: z.array(DaySchema).min(1),
  startMinutes: z.number().int().min(0).max(1439),
  endMinutes: z.number().int().min(1).max(1440),
  location: z.string().optional(),
  activity: z.string().optional(),
}).refine((meeting) => meeting.endMinutes > meeting.startMinutes, { message: "End time must be after start time" });

export const CourseSchema = z.object({
  id: z.string().min(1),
  termId: z.string().min(1),
  departmentId: z.string().optional(),
  code: z.string().min(1),
  titleAr: z.string().min(1),
  titleEn: z.string().optional(),
  credits: z.number().nonnegative(),
});

export const SectionSchema = z.object({
  id: z.string().min(1),
  termId: z.string().min(1),
  courseId: z.string().min(1),
  crn: z.string().min(1),
  sectionCode: z.string().min(1),
  status: z.enum(["open", "closed", "unknown"]),
  instructionalFormat: z.string().optional(),
  instructor: InstructorSchema.optional(),
  meetings: z.array(SectionMeetingSchema),
  linkedSectionIds: z.array(z.string()).default([]),
  capacity: z.object({ total: z.number().int().nonnegative().optional(), remaining: z.number().int().nonnegative().optional() }).optional(),
  restrictions: z.object({ prerequisites: z.string().optional(), colleges: z.array(z.string()).default([]), majors: z.array(z.string()).default([]) }).optional(),
  provenance: z.object({ sourceUrl: z.string().url(), importedAt: z.string().datetime(), sourceLabel: z.string().min(1), rawHash: z.string().optional() }),
});

export const SchedulePlanSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  termId: z.string().min(1),
  sectionIds: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const DataImportSchema = z.object({
  id: z.string().min(1),
  term: AcademicTermSchema,
  college: CollegeSchema,
  studentCategory: StudentCategorySchema.optional(),
  importedAt: z.string().datetime(),
  sourceUrl: z.string().url(),
  sourceLabel: z.string().min(1),
  status: z.enum(["verified-snapshot", "demo", "failed"]),
  courses: z.array(CourseSchema),
  sections: z.array(SectionSchema),
  warnings: z.array(z.string()).default([]),
});

export type AcademicTerm = z.infer<typeof AcademicTermSchema>;
export type College = z.infer<typeof CollegeSchema>;
export type StudentCategory = z.infer<typeof StudentCategorySchema>;
export type Department = z.infer<typeof DepartmentSchema>;
export type Course = z.infer<typeof CourseSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type SectionMeeting = z.infer<typeof SectionMeetingSchema>;
export type Instructor = z.infer<typeof InstructorSchema>;
export type SchedulePlan = z.infer<typeof SchedulePlanSchema>;
export type DataImport = z.infer<typeof DataImportSchema>;
