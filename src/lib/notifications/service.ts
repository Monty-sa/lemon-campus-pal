import type { SectionChange } from "@/lib/kfu-monitor/types";
import { isWithinQuietHours } from "./quiet-hours";
import type {
  InAppNotification,
  NotificationDispatchResult,
  StoredPushSubscription,
} from "./types";

export const NOTIFICATIONS_STORAGE_KEY = "lemon.in-app-notifications.v1";
export const DEVICE_ID_STORAGE_KEY = "lemon.device-id.v1";

/**
 * Retrieves or initializes an anonymous device token for guest notification tracking.
 */
export function getOrCreateDeviceId(storage: Pick<Storage, "getItem" | "setItem">): string {
  try {
    const existing = storage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && existing.length >= 10) {
      return existing;
    }
    const freshId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `lemon-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    storage.setItem(DEVICE_ID_STORAGE_KEY, freshId);
    return freshId;
  } catch {
    return "guest-ephemeral-device";
  }
}

/**
 * Loads cached in-app notifications for guests from local storage.
 */
export function loadInAppNotifications(storage: Pick<Storage, "getItem">): InAppNotification[] {
  try {
    const raw = storage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Saves in-app notifications to local storage.
 */
export function saveInAppNotifications(
  storage: Pick<Storage, "setItem">,
  notifications: InAppNotification[],
): void {
  try {
    storage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications.slice(0, 50)));
  } catch {
    // Gracefully handle storage limitations
  }
}

export function createInAppNotificationFromChange(
  change: SectionChange,
  deviceId: string,
  userId?: string | null,
): InAppNotification {
  const titles: Record<string, string> = {
    added: "New Section Added 🔔",
    cancelled: "Section Cancelled ⚠️",
    availability_changed: "Availability Updated 🔄",
    schedule_changed: "Timetable Changed 🕒",
    instructor_changed: "Instructor Updated 👤",
  };

  return {
    id: `notif-${change.crn}-${change.changeType}-${new Date(change.detectedAt).getTime()}`,
    userId: userId ?? null,
    deviceId,
    crn: change.crn,
    title: titles[change.changeType] ?? "Section Update 🍋",
    body: change.summary,
    changeType: change.changeType,
    readAt: null,
    createdAt: change.detectedAt,
  };
}

/**
 * Coordinates notification dispatch across subscriptions.
 * Enforces per-CRN subscription filter, quiet hours suppression, and deduplication.
 */
export async function dispatchSectionChangeNotifications(options: {
  changes: SectionChange[];
  subscriptions: StoredPushSubscription[];
  currentTimeHHMM?: string;
  pushSender?: (sub: StoredPushSubscription, title: string, body: string) => Promise<{ ok: boolean; status?: number }>;
  onDeleteDeadSubscription?: (subscriptionId: string) => Promise<void>;
}): Promise<NotificationDispatchResult> {
  const result: NotificationDispatchResult = {
    inAppCount: 0,
    pushAttemptedCount: 0,
    pushDeliveredCount: 0,
    pushFailedCount: 0,
    skippedQuietHoursCount: 0,
    expiredSubscriptionsRemoved: 0,
  };

  const processedDedupeKeys = new Set<string>();
  const currentTime = options.currentTimeHHMM ?? new Date().toTimeString().slice(0, 5);

  for (const change of options.changes) {
    const dedupeKey = `${change.crn}:${change.changeType}:${change.detectedAt.slice(0, 13)}`;
    if (processedDedupeKeys.has(dedupeKey)) continue;
    processedDedupeKeys.add(dedupeKey);

    result.inAppCount += 1;

    // Evaluate matching push subscriptions
    for (const sub of options.subscriptions) {
      // Must be subscribed to this CRN
      if (!sub.subscribedCrns.includes(change.crn)) {
        continue;
      }

      // Quiet hours check
      if (sub.quietHoursEnabled && isWithinQuietHours(currentTime, sub.quietHoursStart, sub.quietHoursEnd)) {
        result.skippedQuietHoursCount += 1;
        continue;
      }

      result.pushAttemptedCount += 1;

      if (options.pushSender) {
        try {
          const sendResult = await options.pushSender(
            sub,
            `LEMON Alert: CRN ${change.crn}`,
            change.summary,
          );

          if (sendResult.ok) {
            result.pushDeliveredCount += 1;
          } else {
            result.pushFailedCount += 1;
            // Handle dead/expired subscriptions (404 Not Found or 410 Gone)
            if ((sendResult.status === 404 || sendResult.status === 410) && sub.id && options.onDeleteDeadSubscription) {
              await options.onDeleteDeadSubscription(sub.id);
              result.expiredSubscriptionsRemoved += 1;
            }
          }
        } catch {
          result.pushFailedCount += 1;
        }
      }
    }
  }

  return result;
}
