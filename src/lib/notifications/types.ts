export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface StoredPushSubscription {
  id?: string;
  userId?: string | null;
  deviceId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  subscribedCrns: string[];
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "HH:MM", e.g. "22:00"
  quietHoursEnd: string; // "HH:MM", e.g. "07:00"
  createdAt?: string;
  updatedAt?: string;
}

export interface InAppNotification {
  id: string;
  userId?: string | null;
  deviceId: string;
  crn: string;
  title: string;
  body: string;
  changeType: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationDispatchResult {
  inAppCount: number;
  pushAttemptedCount: number;
  pushDeliveredCount: number;
  pushFailedCount: number;
  skippedQuietHoursCount: number;
  expiredSubscriptionsRemoved: number;
}
