import { describe, expect, it } from "vitest";
import { GET as getSnapshot } from "./route";
import { setSnapshotStoreForTesting, MemorySnapshotStore } from "@/lib/kfu-monitor/storage";
import { maleOfferings, femaleOfferings } from "@/data/offerings";

describe("KFU Snapshot API Route (/api/kfu/snapshot)", () => {
  it("returns active male snapshot from durable store or fallback", async () => {
    const store = new MemorySnapshotStore(true);
    setSnapshotStoreForTesting(store);

    const req = new Request("http://localhost/api/kfu/snapshot?category=11");
    const res = await getSnapshot(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.snapshot).toBeDefined();
    expect(body.snapshot.term.id).toBe("144820");
    expect(body.snapshot.studentCategory.id).toBe("11");
    expect(body.snapshot.courses.length).toBe(maleOfferings.courses.length);
    expect(res.headers.get("Cache-Control")).toContain("public");
  });

  it("returns active female snapshot for category=12", async () => {
    const store = new MemorySnapshotStore(true);
    setSnapshotStoreForTesting(store);

    const req = new Request("http://localhost/api/kfu/snapshot?category=12");
    const res = await getSnapshot(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.snapshot.studentCategory.id).toBe("12");
    expect(body.snapshot.courses.length).toBe(femaleOfferings.courses.length);
  });
});
