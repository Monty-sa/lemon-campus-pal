/**
 * Checks whether a given time string (HH:MM in 24-hour format) falls within quiet hours.
 * Properly handles wrap-around over midnight (e.g., 22:00 to 07:00).
 */
export function isWithinQuietHours(
  currentTimeHHMM: string,
  startHHMM: string,
  endHHMM: string,
): boolean {
  const toMinutes = (timeStr: string) => {
    const parts = timeStr.split(":").map(Number);
    if (parts.length !== 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) {
      return 0;
    }
    return parts[0] * 60 + parts[1];
  };

  const current = toMinutes(currentTimeHHMM);
  const start = toMinutes(startHHMM);
  const end = toMinutes(endHHMM);

  if (start <= end) {
    // Normal window within the same day, e.g. 13:00 to 15:00
    return current >= start && current < end;
  }

  // Window wraps around midnight, e.g. 22:00 to 07:00
  return current >= start || current < end;
}
