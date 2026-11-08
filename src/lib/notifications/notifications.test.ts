import { describe, expect, it, vi } from "vitest";
import type { SectionChange } from "@/lib/kfu-monitor/types";
import { isWithinQuietHours } from "./quiet-hours";
import { buildVapidHeaders, createVapidJwt, generateVapidKeys } from "./vapid";
import {
  createInAppNotificationFromChange,
  dispatchSectionChangeNotifications,
  getOrCreateDeviceId,
  loadInAppNotifications,
  saveInAppNotifications,
} from "./service";
import type { InAppNotification, StoredPushSubscription } from "./types";

describe("Quiet Hours Window Evaluator", () => {
  it("evaluates normal same-day quiet hours correctly", () => {
    // 13:00 to 15:00
    expect(isWithinQuietHours("12:59", "13:00", "15:00")).toBe(false);
    expect(isWithinQuietHours("13:00", "13:00", "15:00")).toBe(true);
    expect(isWithinQuietHours("14:30", "13:00", "15:00")).toBe(true);
    expect(isWithinQuietHours("15:00", "13:00", "15:00")).toBe(false);
  });

  it("evaluates quiet hours spanning across midnight correctly", () => {
    // 22:00 to 07:00
    expect(isWithinQuietHours("21:59", "22:00", "07:00")).toBe(false);
    expect(isWithinQuietHours("22:00", "22:00", "07:00")).toBe(true);
    expect(isWithinQuietHours("23:30", "22:00", "07:00")).toBe(true);
    expect(isWithinQuietHours("03:15", "22:00", "07:00")).toBe(true);
    expect(isWithinQuietHours("06:59", "22:00", "07:00")).toBe(true);
    expect(isWithinQuietHours("07:00", "22:00", "07:00")).toBe(false);
    expect(isWithinQuietHours("14:00", "22:00", "07:00")).toBe(false);
  });
});

describe("VAPID Keys & Token Generation", () => {
  it("generates valid P-256 keypair and signs ES256 VAPID JWT", () => {
    const keys = generateVapidKeys();
    expect(keys.publicKey).toBeDefined();
    expect(keys.publicKey.length).toBeGreaterThan(50);
    expect(keys.privateKey).toContain("BEGIN PRIVATE KEY");

    const jwt = createVapidJwt({
      audience: "https://fcm.googleapis.com",
      subject: "mailto:alerts@yourpallemon.app",
      privateKeyPem: keys.privateKey,
    });

    const parts = jwt.split(".");
    expect(parts).toHaveLength(3);

    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    expect(header).toEqual({ typ: "JWT", alg: "ES256" });

    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    expect(payload.aud).toBe("https://fcm.googleapis.com");
    expect(payload.sub).toBe("mailto:alerts@yourpallemon.app");
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("builds correct Web Push VAPID headers", () => {
    const keys = generateVapidKeys();
    const headers = buildVapidHeaders({
      endpoint: "https://updates.push.services.mozilla.com/wpush/v2/abc123",
      subject: "mailto:admin@lemon.app",
      publicKey: keys.publicKey,
      privateKeyPem: keys.privateKey,
    });

    expect(headers.Authorization).toMatch(/^vapid t=[^,]+, k=.+$/);
  });
});

describe("In-App Notification & Dispatch Service", () => {
  it("creates structured in-app notification from section change", () => {
    const change: SectionChange = {
      termId: "144820",
      categoryCode: "11",
      crn: "63953",
      courseCode: "ACCT-101",
      changeType: "availability_changed",
      summary: "CRN 63953 status changed from closed to open.",
      detectedAt: "2026-11-07T12:00:00Z",
    };

    const notif = createInAppNotificationFromChange(change, "device-123", "user-456");
    expect(notif.crn).toBe("63953");
    expect(notif.title).toContain("Availability Updated");
    expect(notif.body).toContain("CRN 63953 status changed");
    expect(notif.readAt).toBeNull();
  });

  it("persists and reads guest device ID and in-app notifications in storage", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => store.set(key, val),
    };

    const deviceId1 = getOrCreateDeviceId(storage);
    expect(deviceId1).toBeDefined();
    expect(deviceId1.length).toBeGreaterThan(10);

    // Calling again returns existing ID
    const deviceId2 = getOrCreateDeviceId(storage);
    expect(deviceId2).toBe(deviceId1);

    const testNotifications: InAppNotification[] = [
      {
        id: "n1",
        deviceId: deviceId1,
        crn: "63953",
        title: "Test",
        body: "Body",
        changeType: "added",
        readAt: null,
        createdAt: "2026-11-07T00:00:00Z",
      },
    ];

    saveInAppNotifications(storage, testNotifications);
    const loaded = loadInAppNotifications(storage);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe("n1");
  });

  it("dispatches notifications filtering by CRN subscription and quiet hours", async () => {
    const subscriptions: StoredPushSubscription[] = [
      // Sub 1: Subscribed to 63953, quiet hours disabled
      {
        id: "sub-1",
        deviceId: "dev-1",
        endpoint: "https://push.example.com/sub1",
        p256dh: "key1",
        auth: "auth1",
        subscribedCrns: ["63953"],
        quietHoursEnabled: false,
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
      },
      // Sub 2: Subscribed to 64000 (not 63953)
      {
        id: "sub-2",
        deviceId: "dev-2",
        endpoint: "https://push.example.com/sub2",
        p256dh: "key2",
        auth: "auth2",
        subscribedCrns: ["64000"],
        quietHoursEnabled: false,
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
      },
      // Sub 3: Subscribed to 63953, but currently in quiet hours (23:00)
      {
        id: "sub-3",
        deviceId: "dev-3",
        endpoint: "https://push.example.com/sub3",
        p256dh: "key3",
        auth: "auth3",
        subscribedCrns: ["63953"],
        quietHoursEnabled: true,
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
      },
    ];

    const changes: SectionChange[] = [
      {
        termId: "144820",
        categoryCode: "11",
        crn: "63953",
        courseCode: "ACCT-101",
        changeType: "availability_changed",
        summary: "Available now",
        detectedAt: "2026-11-07T23:00:00Z",
      },
    ];

    const mockSender = vi.fn().mockResolvedValue({ ok: true });

    const result = await dispatchSectionChangeNotifications({
      changes,
      subscriptions,
      currentTimeHHMM: "23:00",
      pushSender: mockSender,
    });

    expect(result.inAppCount).toBe(1);
    expect(result.pushAttemptedCount).toBe(1); // Only sub-1
    expect(result.pushDeliveredCount).toBe(1);
    expect(result.skippedQuietHoursCount).toBe(1); // sub-3 skipped
    expect(mockSender).toHaveBeenCalledTimes(1);
  });

  it("cleans up dead/expired push subscriptions when receiving 404 or 410", async () => {
    const deadSub: StoredPushSubscription = {
      id: "dead-sub-1",
      deviceId: "dev-expired",
      endpoint: "https://push.example.com/dead",
      p256dh: "k",
      auth: "a",
      subscribedCrns: ["63953"],
      quietHoursEnabled: false,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
    };

    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const mockSender = vi.fn().mockResolvedValue({ ok: false, status: 410 });

    const result = await dispatchSectionChangeNotifications({
      changes: [
        {
          termId: "144820",
          categoryCode: "11",
          crn: "63953",
          courseCode: "ACCT-101",
          changeType: "cancelled",
          summary: "Cancelled",
          detectedAt: "2026-11-07T12:00:00Z",
        },
      ],
      subscriptions: [deadSub],
      pushSender: mockSender,
      onDeleteDeadSubscription: deleteFn,
    });

    expect(result.pushFailedCount).toBe(1);
    expect(result.expiredSubscriptionsRemoved).toBe(1);
    expect(deleteFn).toHaveBeenCalledWith("dead-sub-1");
  });
});
