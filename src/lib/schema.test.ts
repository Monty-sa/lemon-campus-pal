import { describe, expect, it } from "vitest";
import { SectionSchema } from "./schema";

const base = {
  id: "t:s", termId: "t", courseId: "t:c", crn: "123", sectionCode: "1", status: "unknown" as const,
  meetings: [{ id: "m", days: ["sun"], startMinutes: 540, endMinutes: 600 }], linkedSectionIds: [],
  provenance: { sourceUrl: "https://example.com", importedAt: "2026-11-07T00:00:00.000Z", sourceLabel: "test" },
};

describe("normalized schemas", () => {
  it("accepts missing instructor and classroom information", () => {
    const result = SectionSchema.parse(base);
    expect(result.instructor).toBeUndefined();
    expect(result.meetings[0].location).toBeUndefined();
  });

  it("rejects an incomplete CRN", () => {
    expect(SectionSchema.safeParse({ ...base, crn: "" }).success).toBe(false);
  });

  it("rejects a meeting that ends before it starts", () => {
    expect(SectionSchema.safeParse({ ...base, meetings: [{ ...base.meetings[0], startMinutes: 700, endMinutes: 600 }] }).success).toBe(false);
  });
});
