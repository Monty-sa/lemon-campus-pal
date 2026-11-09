import { describe, expect, it } from "vitest";
import { layoutOverlappingItems } from "./meeting-layout";

describe("overlapping timetable card layout", () => {
  it("places CRN 66843 beside International Economics for the reported Monday and Wednesday overlaps", () => {
    const items = [
      { key: "66843-mon", startMinutes: 630, endMinutes: 705 },
      { key: "66843-wed", startMinutes: 630, endMinutes: 705 },
      { key: "66843-tue", startMinutes: 840, endMinutes: 915 },
      { key: "international-economics-mon", startMinutes: 630, endMinutes: 705 },
      { key: "international-economics-wed", startMinutes: 630, endMinutes: 705 },
    ];
    for (const day of ["mon", "wed"]) {
      const laidOut = layoutOverlappingItems(items.filter((item) => item.key.endsWith(`-${day}`)));
      expect(laidOut.find((item) => item.key === `66843-${day}`)).toMatchObject({ laneIndex: 0, laneCount: 2 });
      expect(laidOut.find((item) => item.key === `international-economics-${day}`)).toMatchObject({ laneIndex: 1, laneCount: 2 });
    }
    expect(layoutOverlappingItems(items.filter((item) => item.key === "66843-tue")))
      .toMatchObject([{ key: "66843-tue", laneIndex: 0, laneCount: 1 }]);
  });

  it("uses the minimum number of lanes for partial, chained overlaps and reuses lanes", () => {
    const laidOut = layoutOverlappingItems([
      { key: "first", startMinutes: 600, endMinutes: 660 },
      { key: "second", startMinutes: 630, endMinutes: 690 },
      { key: "third", startMinutes: 660, endMinutes: 720 },
      { key: "later", startMinutes: 750, endMinutes: 810 },
    ]);
    expect(laidOut.find((item) => item.key === "first")).toMatchObject({ laneIndex: 0, laneCount: 2 });
    expect(laidOut.find((item) => item.key === "second")).toMatchObject({ laneIndex: 1, laneCount: 2 });
    expect(laidOut.find((item) => item.key === "third")).toMatchObject({ laneIndex: 0, laneCount: 2 });
    expect(laidOut.find((item) => item.key === "later")).toMatchObject({ laneIndex: 0, laneCount: 1 });
  });

  it("gives three simultaneous meetings distinct lanes and keeps endpoint meetings non-overlapping", () => {
    expect(layoutOverlappingItems([
      { key: "a", startMinutes: 600, endMinutes: 660 },
      { key: "b", startMinutes: 600, endMinutes: 660 },
      { key: "c", startMinutes: 600, endMinutes: 660 },
      { key: "d", startMinutes: 660, endMinutes: 720 },
    ])).toEqual([
      { key: "a", startMinutes: 600, endMinutes: 660, laneIndex: 0, laneCount: 3 },
      { key: "b", startMinutes: 600, endMinutes: 660, laneIndex: 1, laneCount: 3 },
      { key: "c", startMinutes: 600, endMinutes: 660, laneIndex: 2, laneCount: 3 },
      { key: "d", startMinutes: 660, endMinutes: 720, laneIndex: 0, laneCount: 1 },
    ]);
  });
});
