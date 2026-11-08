import { afterEach, beforeEach, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import type { DataImport, Section } from "@/lib/schema";
import { MemorySnapshotStore, resolveBlobsStoreName, setSnapshotStoreForTesting } from "./storage";
import { POST as ingestHandler } from "@/app/api/kfu/ingest/route";
import { KFU_BUSINESS_DATASETS } from "./types";
import {
  loadInitialGuestPlans,
  loadActivePlanId,
  saveGuestPlans,
  saveActivePlanId,
} from "@/lib/storage";

const TEST_SECRET = "test_ingestion_secret_64_characters_long_for_hmac_sha256_testing!";

const generateDataset = (categoryCode: "11" | "12", courses = 164, sections = 389): DataImport => ({
  id: `test-${categoryCode}-snapshot`,
  term: { id: "144820", labelAr: "الفصل الدراسي الثاني للعام الجامعي 1448" },
  college: { id: "06", nameAr: "كلية إدارة الأعمال" },
  studentCategory: {
    id: categoryCode,
    labelAr: categoryCode === "11" ? "طلاب" : "طالبات",
  },
  importedAt: new Date().toISOString(),
  sourceUrl: KFU_BUSINESS_DATASETS[categoryCode].url,
  sourceLabel: "نظام الجداول العام بجامعة الملك فيصل",
  status: "verified-snapshot",
  courses: Array.from({ length: courses }, (_, i) => ({
    id: `144820:060${(i % 9) + 1}-${100 + i}`,
    termId: "144820",
    code: `060${(i % 9) + 1}-${100 + i}`,
    titleAr: `مقرر ${i + 1}`,
    credits: 3,
  })),
  sections: Array.from({ length: sections }, (_, i) => {
    const courseIndex = i % courses;
    const courseCode = `060${(courseIndex % 9) + 1}-${100 + courseIndex}`;
    const crn = `${categoryCode === "11" ? "8" : "9"}${1000 + i}`;
    return {
      id: `144820:${crn}`,
      termId: "144820",
      courseId: `144820:${courseCode}`,
      crn,
      sectionCode: `${(i % 10) + 1}`,
      status: "open" as const,
      linkedSectionIds: [],
      provenance: {
        sourceUrl: "https://ssb-ar.kfu.edu.sa/PROD_ar/ws",
        importedAt: new Date().toISOString(),
        sourceLabel: "KFU",
      },
      meetings: [
        {
          id: `${crn}-1`,
          days: ["sun", "tue", "thu"] as const,
          startMinutes: 480,
          endMinutes: 530,
        },
      ],
    };
  }),
  warnings: [],
});

function createSignedRequest(payload: unknown, secret: string, options?: { timestamp?: string; nonce?: string; signature?: string }): Request {
  const rawBody = JSON.stringify(payload);
  const timestamp = options?.timestamp ?? new Date().toISOString();
  const nonce = options?.nonce ?? crypto.randomBytes(16).toString("hex");
  const signature =
    options?.signature ??
    crypto
      .createHmac("sha256", secret)
      .update(`${timestamp}:${nonce}:${rawBody}`)
      .digest("hex");

  return new Request("https://yourcampuspallemon.netlify.app/api/kfu/ingest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-lemon-timestamp": timestamp,
      "x-lemon-nonce": nonce,
      "x-lemon-signature": signature,
    },
    body: rawBody,
  });
}

describe("LEMON-039 Windows-Based Automated KFU Refresh & Secure Ingestion", () => {
  let mockStore: MemorySnapshotStore;

  beforeEach(() => {
    mockStore = new MemorySnapshotStore(true);
    setSnapshotStoreForTesting(mockStore);
    process.env.KFU_INGESTION_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    setSnapshotStoreForTesting(null);
    delete process.env.KFU_INGESTION_SECRET;
  });

  it("1. Successfully ingests and atomically publishes male and female snapshots with valid HMAC", async () => {
    const male = generateDataset("11", 164, 389);
    const female = generateDataset("12", 168, 540);
    const req = createSignedRequest(
      {
        maleSnapshot: male,
        femaleSnapshot: female,
        sourceMetadata: { fetchedAt: new Date().toISOString(), workerVersion: "1.0.0" },
      },
      TEST_SECRET,
    );

    const res = await ingestHandler(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("published");
    expect(body.male.courseCount).toBe(164);
    expect(body.female.courseCount).toBe(168);
    expect(body.version).toMatch(/^v_/);

    const activeMale = await mockStore.getActiveSnapshot("11");
    const activeFemale = await mockStore.getActiveSnapshot("12");
    expect(activeMale?.courses.length).toBe(164);
    expect(activeFemale?.courses.length).toBe(168);

    const meta = await mockStore.getMetadata();
    expect(meta?.refreshSource).toBe("windows_worker");
    expect(meta?.activeVersion).toBe(body.version);
  });

  it("2. Rejects request with invalid or missing HMAC authentication", async () => {
    const req = createSignedRequest({ test: "data" }, TEST_SECRET, { signature: "invalid_hex_signature_deadbeef" });
    const res = await ingestHandler(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toMatch(/Invalid HMAC signature|Signature verification failed/);
  });

  it("3. Rejects replay attack with skewed timestamp (> 5 minutes old)", async () => {
    const staleTime = new Date(Date.now() - 400_000).toISOString();
    const req = createSignedRequest({ test: "data" }, TEST_SECRET, { timestamp: staleTime });
    const res = await ingestHandler(req);
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error).toContain("outside acceptable window");
  });

  it("4. Rejects replay attack with duplicate nonce", async () => {
    const male = generateDataset("11", 164, 389);
    const female = generateDataset("12", 168, 540);
    const fixedNonce = "test_fixed_nonce_1234567890";
    const payload = {
      maleSnapshot: male,
      femaleSnapshot: female,
      sourceMetadata: { fetchedAt: new Date().toISOString(), workerVersion: "1.0.0" },
    };

    const req1 = createSignedRequest(payload, TEST_SECRET, { nonce: fixedNonce });
    const res1 = await ingestHandler(req1);
    expect(res1.status).toBe(200);

    // Second request using identical nonce must be rejected
    const req2 = createSignedRequest(payload, TEST_SECRET, { nonce: fixedNonce });
    const res2 = await ingestHandler(req2);
    expect(res2.status).toBe(403);

    const body2 = await res2.json();
    expect(body2.error).toContain("duplicate nonce already consumed");
  });

  it("5. Rejects incomplete snapshot with 0 courses or missing sections", async () => {
    const emptyMale = generateDataset("11", 0, 0);
    const female = generateDataset("12", 168, 540);
    const req = createSignedRequest(
      {
        maleSnapshot: emptyMale,
        femaleSnapshot: female,
        sourceMetadata: { fetchedAt: new Date().toISOString(), workerVersion: "1.0.0" },
      },
      TEST_SECRET,
    );

    const res = await ingestHandler(req);
    expect(res.status).toBe(422);

    const body = await res.json();
    expect(body.error).toContain("Male snapshot validation failed");
  });

  it("6. Rejects unexpected large data drops (>40% sections drop)", async () => {
    const droppedFemale = generateDataset("12", 168, 250); // 250 vs baseline 540 is >50% drop, > VALIDATION_THRESHOLDS.MIN_SECTIONS (200)
    const male = generateDataset("11", 164, 389);
    const req = createSignedRequest(
      {
        maleSnapshot: male,
        femaleSnapshot: droppedFemale,
        sourceMetadata: { fetchedAt: new Date().toISOString(), workerVersion: "1.0.0" },
      },
      TEST_SECRET,
    );

    const res = await ingestHandler(req);
    expect(res.status).toBe(422);

    const body = await res.json();
    expect(body.error).toContain("Female snapshot validation failed");
    expect(body.failureReason).toContain("Suspicious data drop");
  });

  it("7. Rejects duplicate CRNs within section records", async () => {
    const male = generateDataset("11", 164, 389);
    // Duplicate first CRN
    const duplicateSection: Section = { ...male.sections[0], id: "144820:duplicate" };
    male.sections.push(duplicateSection);

    const female = generateDataset("12", 168, 540);
    const req = createSignedRequest(
      {
        maleSnapshot: male,
        femaleSnapshot: female,
        sourceMetadata: { fetchedAt: new Date().toISOString(), workerVersion: "1.0.0" },
      },
      TEST_SECRET,
    );

    const res = await ingestHandler(req);
    expect(res.status).toBe(422);

    const body = await res.json();
    expect(body.failureReason).toContain("Duplicate CRN detected");
  });

  it("8. Rejects dataset category mismatch (wrong studentCategory id)", async () => {
    const male = generateDataset("11", 164, 389);
    // Tamper with category id
    if (male.studentCategory) {
      male.studentCategory.id = "12";
    }
    const female = generateDataset("12", 168, 540);

    const req = createSignedRequest(
      {
        maleSnapshot: male,
        femaleSnapshot: female,
        sourceMetadata: { fetchedAt: new Date().toISOString(), workerVersion: "1.0.0" },
      },
      TEST_SECRET,
    );

    const res = await ingestHandler(req);
    expect(res.status).toBe(422);

    const body = await res.json();
    expect(body.error).toContain("Dataset gender category mismatch");
  });

  it("9. Supports immutable versioned snapshot storage and read-back", async () => {
    const male = generateDataset("11", 164, 389);
    const female = generateDataset("12", 168, 540);
    const version = "v_test_version_12345";

    await mockStore.atomicPublish({
      maleSnapshot: male,
      femaleSnapshot: female,
      maleDiff: [],
      femaleDiff: [],
      metadata: {
        lastAttemptedCheck: new Date().toISOString(),
        maleCourseCount: 164,
        maleSectionCount: 389,
        femaleCourseCount: 168,
        femaleSectionCount: 540,
        sourceHealth: "healthy",
        disclaimer: "Historical snapshot",
        attestation: "LEMON-039",
      },
      version,
    });

    const versionedMale = await mockStore.getVersionedSnapshot(version, "11");
    const versionedFemale = await mockStore.getVersionedSnapshot(version, "12");
    expect(versionedMale?.courses.length).toBe(164);
    expect(versionedFemale?.courses.length).toBe(168);
  });

  it("10. Recovers last-known-good snapshot when publish fails", async () => {
    const baselineMale = await mockStore.getActiveSnapshot("11");
    expect(baselineMale).not.toBeNull();

    mockStore.simulateFailureOnPublish = true;
    const newMale = generateDataset("11", 164, 389);
    const newFemale = generateDataset("12", 168, 540);

    await expect(
      mockStore.atomicPublish({
        maleSnapshot: newMale,
        femaleSnapshot: newFemale,
        maleDiff: [],
        femaleDiff: [],
        metadata: {
          lastAttemptedCheck: new Date().toISOString(),
          maleCourseCount: 164,
          maleSectionCount: 389,
          femaleCourseCount: 168,
          femaleSectionCount: 540,
          sourceHealth: "healthy",
          disclaimer: "Historical snapshot",
          attestation: "LEMON-039",
        },
      }),
    ).rejects.toThrow(/Simulated storage write failure/);

    // Active snapshot must remain restored to previous baseline
    const activeMaleAfterCrash = await mockStore.getActiveSnapshot("11");
    expect(activeMaleAfterCrash?.id).toBe(baselineMale?.id);
  });

  it("11. Preserves existing guest plans, GPA preferences, and active-plan selections", async () => {
    const storeMap = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => storeMap.get(k) ?? null,
      setItem: (k: string, v: string) => storeMap.set(k, v),
      removeItem: (k: string) => storeMap.delete(k),
    };

    const initialPlans = loadInitialGuestPlans(mockStorage, "144820");
    saveGuestPlans(mockStorage, initialPlans);
    saveActivePlanId(mockStorage, "guest-plan-alpha");

    expect(loadActivePlanId(mockStorage)).toBe("guest-plan-alpha");

    // Perform refresh ingestion
    const male = generateDataset("11", 164, 389);
    const female = generateDataset("12", 168, 540);
    const req = createSignedRequest(
      {
        maleSnapshot: male,
        femaleSnapshot: female,
        sourceMetadata: { fetchedAt: new Date().toISOString(), workerVersion: "1.0.0" },
      },
      TEST_SECRET,
    );

    const res = await ingestHandler(req);
    expect(res.status).toBe(200);

    // Verify guest plans in local client storage were not touched or cleared
    const postRefreshPlans = loadInitialGuestPlans(mockStorage, "144820");
    expect(postRefreshPlans.length).toBe(initialPlans.length);
    expect(loadActivePlanId(mockStorage)).toBe("guest-plan-alpha");
  });

  it("12. Fails closed with HTTP 500 when server ingestion secret is not configured", async () => {
    delete process.env.KFU_INGESTION_SECRET;

    const req = new Request("https://yourcampuspallemon.netlify.app/api/kfu/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-lemon-timestamp": new Date().toISOString(),
        "x-lemon-nonce": "sample_nonce_123456",
        "x-lemon-signature": "any_signature",
      },
      body: JSON.stringify({}),
    });

    const res = await ingestHandler(req);
    expect(res.status).toBe(500);

    const body = await res.json();
    expect(body.error).toContain("missing KFU_INGESTION_SECRET");
  });

  it("13. Adversarial concurrent replay attack: rejects concurrent simultaneous requests sharing the same nonce", async () => {
    const male = generateDataset("11", 164, 389);
    const female = generateDataset("12", 168, 540);
    const sharedNonce = "adversarial_concurrent_nonce_" + Date.now();
    const payload = {
      maleSnapshot: male,
      femaleSnapshot: female,
      sourceMetadata: { fetchedAt: new Date().toISOString(), workerVersion: "1.0.0" },
    };

    const req1 = createSignedRequest(payload, TEST_SECRET, { nonce: sharedNonce });
    const req2 = createSignedRequest(payload, TEST_SECRET, { nonce: sharedNonce });

    // Race both requests simultaneously
    const [res1, res2] = await Promise.all([ingestHandler(req1), ingestHandler(req2)]);

    const statuses = [res1.status, res2.status].sort();
    // Exactly one must succeed (200) and one must be rejected (403)
    expect(statuses).toEqual([200, 403]);

    const rejectedRes = res1.status === 403 ? res1 : res2;
    const body = await rejectedRes.json();
    expect(body.error).toContain("duplicate nonce already consumed");
  });

  it("14. Strongly consistent single active:pointer couples male and female datasets without dataset skew", async () => {
    const maleV1 = generateDataset("11", 164, 389);
    const femaleV1 = generateDataset("12", 168, 540);
    const version1 = "v_first_consistent_release";

    await mockStore.atomicPublish({
      maleSnapshot: maleV1,
      femaleSnapshot: femaleV1,
      maleDiff: [],
      femaleDiff: [],
      metadata: {
        lastAttemptedCheck: new Date().toISOString(),
        maleCourseCount: 164,
        maleSectionCount: 389,
        femaleCourseCount: 168,
        femaleSectionCount: 540,
        sourceHealth: "healthy",
        disclaimer: "V1",
        attestation: "LEMON-039H",
      },
      version: version1,
    });

    const pointer1 = await mockStore.getActivePointer();
    expect(pointer1?.version).toBe(version1);
    expect((await mockStore.getActiveSnapshot("11"))?.courses.length).toBe(164);
    expect((await mockStore.getActiveSnapshot("12"))?.courses.length).toBe(168);

    // Now publish V2 with updated course counts
    const maleV2 = generateDataset("11", 165, 395);
    const femaleV2 = generateDataset("12", 170, 545);
    const version2 = "v_second_consistent_release";

    await mockStore.atomicPublish({
      maleSnapshot: maleV2,
      femaleSnapshot: femaleV2,
      maleDiff: [],
      femaleDiff: [],
      metadata: {
        lastAttemptedCheck: new Date().toISOString(),
        maleCourseCount: 165,
        maleSectionCount: 395,
        femaleCourseCount: 170,
        femaleSectionCount: 545,
        sourceHealth: "healthy",
        disclaimer: "V2",
        attestation: "LEMON-039H",
      },
      version: version2,
    });

    // Readers reading through active:pointer see exactly V2 for both male and female
    const pointer2 = await mockStore.getActivePointer();
    expect(pointer2?.version).toBe(version2);
    expect(pointer2?.maleCourseCount).toBe(165);
    expect(pointer2?.femaleCourseCount).toBe(170);

    const activeMale = await mockStore.getActiveSnapshot("11");
    const activeFemale = await mockStore.getActiveSnapshot("12");
    expect(activeMale?.courses.length).toBe(165);
    expect(activeFemale?.courses.length).toBe(170);

    // Rollback to previous restores V1 atomically for both
    const rollback = await mockStore.rollbackToPrevious();
    expect(rollback.rolledBack).toBe(true);

    const pointerAfterRollback = await mockStore.getActivePointer();
    expect(pointerAfterRollback?.version).toBe(version1);
    expect((await mockStore.getActiveSnapshot("11"))?.courses.length).toBe(164);
    expect((await mockStore.getActiveSnapshot("12"))?.courses.length).toBe(168);
  });

  it("15. Deploy preview isolation: resolveBlobsStoreName isolates preview writes from production store", () => {
    const originalContext = process.env.CONTEXT;
    const originalStoreName = process.env.KFU_BLOBS_STORE_NAME;

    try {
      delete process.env.KFU_BLOBS_STORE_NAME;

      // 1. Production context must resolve to canonical production store
      process.env.CONTEXT = "production";
      expect(resolveBlobsStoreName()).toBe("kfu-snapshots");

      // 2. Deploy preview context must resolve to isolated preview store
      process.env.CONTEXT = "deploy-preview";
      expect(resolveBlobsStoreName()).toBe("kfu-snapshots-deploy-preview");

      // 3. Branch deploy context must resolve to isolated branch store
      process.env.CONTEXT = "branch-deploy";
      expect(resolveBlobsStoreName()).toBe("kfu-snapshots-branch-deploy");

      // 4. Custom explicit override takes highest priority
      process.env.KFU_BLOBS_STORE_NAME = "custom-test-snapshots";
      expect(resolveBlobsStoreName()).toBe("custom-test-snapshots");
    } finally {
      if (originalContext !== undefined) process.env.CONTEXT = originalContext;
      else delete process.env.CONTEXT;

      if (originalStoreName !== undefined) process.env.KFU_BLOBS_STORE_NAME = originalStoreName;
      else delete process.env.KFU_BLOBS_STORE_NAME;
    }
  });

  it("16. Atomic nonce claim durability: claimNonce rejects repeated claims", async () => {
    const nonce = "durable_nonce_test_claim_" + Date.now();
    const ts = Date.now();

    const firstClaim = await mockStore.claimNonce(nonce, ts);
    expect(firstClaim).toBe(true);

    const secondClaim = await mockStore.claimNonce(nonce, ts);
    expect(secondClaim).toBe(false);

    const thirdClaim = await mockStore.claimNonce(nonce, ts + 1000);
    expect(thirdClaim).toBe(false);
  });
});
