import { describe, expect, it } from "vitest";
import { GET as getStatus } from "./route";
import { setSnapshotStoreForTesting, MemorySnapshotStore } from "@/lib/kfu-monitor/storage";
import { KFU_OWNER_ATTESTATION } from "@/lib/kfu-monitor/types";

describe("KFU Status API Route (/api/kfu/status)", () => {
  it("returns truthful metadata including timestamps, counts, health, and disclaimer", async () => {
    const store = new MemorySnapshotStore(true);
    setSnapshotStoreForTesting(store);

    const res = await getStatus();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.sourceHealth).toBe("healthy");
    expect(body.lastAttemptedCheck).toBeDefined();
    expect(body.maleCourseCount).toBeGreaterThan(50);
    expect(body.femaleCourseCount).toBeGreaterThan(50);
    expect(body.disclaimer).toContain("Seat availability");
    expect(body.attestation).toBe(KFU_OWNER_ATTESTATION);
    expect(res.headers.get("Cache-Control")).toContain("public");
  });
});
