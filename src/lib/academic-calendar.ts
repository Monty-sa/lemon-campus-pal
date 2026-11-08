import type { AcademicCalendarEvent } from "@/data/academic-calendar";

export type EventStatus = "active" | "upcoming" | "finished";

/**
 * Returns the current date in 'YYYY-MM-DD' formatted according to Asia/Riyadh (KSA) timezone.
 */
export function getRiyadhDateString(date: Date = new Date()): string {
  // Saudi Arabia is UTC+3 (Asia/Riyadh)
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date); // outputs YYYY-MM-DD
}

/**
 * Determines whether an academic event is active (ongoing today), upcoming, or finished.
 */
export function getEventStatus(
  event: AcademicCalendarEvent,
  now: Date = new Date(),
): EventStatus {
  const todayStr = getRiyadhDateString(now);

  if (todayStr >= event.startDate && todayStr <= event.endDate) {
    return "active";
  }
  if (todayStr < event.startDate) {
    return "upcoming";
  }
  return "finished";
}

/**
 * Finds the most relevant upcoming or currently active registration event for display.
 * Returns null if all relevant events have expired.
 */
export function getActiveOrUpcomingRegistrationEvent(
  events: AcademicCalendarEvent[],
  now: Date = new Date(),
  category: "registration" | "all" = "registration",
): AcademicCalendarEvent | null {
  const pool = category === "registration" ? events.filter((e) => e.category === "registration") : events;
  const activeEvents = pool.filter((e) => getEventStatus(e, now) === "active");
  if (activeEvents.length > 0) {
    return activeEvents[0];
  }

  const upcomingEvents = pool
    .filter((e) => getEventStatus(e, now) === "upcoming")
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  return upcomingEvents[0] ?? null;
}

/**
 * Formats a Gregorian date range into localized student-friendly text.
 */
export function formatGregorianRange(
  startDate: string,
  endDate: string,
  lang: "ar" | "en",
): string {
  const [startY, startM, startD] = startDate.split("-").map(Number);
  const [endY, endM, endD] = endDate.split("-").map(Number);

  const start = new Date(Date.UTC(startY, startM - 1, startD));
  const end = new Date(Date.UTC(endY, endM - 1, endD));

  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  };

  const startFormatted = start.toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", {
    ...options,
    year: startY !== endY ? "numeric" : undefined,
  });
  const endFormatted = end.toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", {
    ...options,
    year: "numeric",
  });

  return `${startFormatted} – ${endFormatted}`;
}
