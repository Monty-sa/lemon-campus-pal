export type TimedLayoutItem = {
  key: string;
  startMinutes: number;
  endMinutes: number;
};

export type LaidOutItem<T extends TimedLayoutItem> = T & {
  laneIndex: number;
  laneCount: number;
};

/**
 * Places intersecting intervals in side-by-side lanes. Meetings that only
 * touch at an endpoint do not overlap, matching the schedule conflict rules.
 */
export function layoutOverlappingItems<T extends TimedLayoutItem>(items: T[]): LaidOutItem<T>[] {
  const sorted = [...items].sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes || a.key.localeCompare(b.key));
  const result: LaidOutItem<T>[] = [];
  let component: T[] = [];
  let componentEnd = Number.NEGATIVE_INFINITY;

  const layoutComponent = (group: T[]) => {
    if (!group.length) return;
    const laneEnds: number[] = [];
    const placements: Array<{ item: T; laneIndex: number }> = [];

    for (const item of group) {
      let laneIndex = laneEnds.findIndex((end) => end <= item.startMinutes);
      if (laneIndex === -1) laneIndex = laneEnds.length;
      laneEnds[laneIndex] = item.endMinutes;
      placements.push({ item, laneIndex });
    }

    const laneCount = laneEnds.length;
    for (const placement of placements) {
      result.push({ ...placement.item, laneIndex: placement.laneIndex, laneCount });
    }
  };

  for (const item of sorted) {
    if (component.length && item.startMinutes >= componentEnd) {
      layoutComponent(component);
      component = [];
      componentEnd = Number.NEGATIVE_INFINITY;
    }
    component.push(item);
    componentEnd = Math.max(componentEnd, item.endMinutes);
  }

  layoutComponent(component);
  return result;
}
