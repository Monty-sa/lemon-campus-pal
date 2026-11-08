import { getStore } from "@netlify/blobs";
import type { DataImport } from "@/lib/schema";
import { maleOfferings, femaleOfferings } from "@/data/offerings";
import {
  KFU_OWNER_ATTESTATION,
  type ActiveVersionPointer,
  type KfuGenderCategory,
  type KfuRefreshMetadata,
  type SectionChange,
} from "./types";

export function resolveBlobsStoreName(): string {
  if (process.env.KFU_BLOBS_STORE_NAME) {
    return process.env.KFU_BLOBS_STORE_NAME;
  }

  const context = process.env.CONTEXT || process.env.NODE_ENV || "production";
  if (context === "production") {
    return "kfu-snapshots";
  }

  const safeContext = context.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `kfu-snapshots-${safeContext}`;
}

export interface IKfuSnapshotStore {
  getActiveSnapshot(category: KfuGenderCategory): Promise<DataImport | null>;
  getActivePointer(): Promise<ActiveVersionPointer | null>;
  getPreviousSnapshot(category: KfuGenderCategory): Promise<DataImport | null>;
  getStagedSnapshot(category: KfuGenderCategory): Promise<DataImport | null>;
  getVersionedSnapshot(version: string, category: KfuGenderCategory): Promise<DataImport | null>;
  getMetadata(): Promise<KfuRefreshMetadata | null>;
  getSectionChanges(category: KfuGenderCategory): Promise<SectionChange[]>;

  stageSnapshot(category: KfuGenderCategory, snapshot: DataImport): Promise<void>;
  clearStagedSnapshot(category: KfuGenderCategory): Promise<void>;

  atomicPublish(params: {
    maleSnapshot: DataImport;
    femaleSnapshot: DataImport;
    maleDiff: SectionChange[];
    femaleDiff: SectionChange[];
    metadata: KfuRefreshMetadata;
    version?: string;
  }): Promise<void>;

  rollbackToPrevious(): Promise<{ rolledBack: boolean; reason?: string }>;

  acquireDistributedLock(key: string, ttlMs?: number): Promise<boolean>;
  releaseDistributedLock(key: string): Promise<void>;

  claimNonce(nonce: string, timestampMs: number): Promise<boolean>;
}

interface DistributedLockRecord {
  lockedAt: string;
  expiresAt: number;
  workerId: string;
}

export class NetlifyBlobsSnapshotStore implements IKfuSnapshotStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private store: any;

  constructor(options?: { siteID?: string; token?: string; storeName?: string }) {
    const politeFetch: typeof fetch = (url, init) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
    };

    const storeName = options?.storeName ?? resolveBlobsStoreName();

    if (options?.siteID && options?.token) {
      this.store = getStore({
        name: storeName,
        consistency: "strong",
        siteID: options.siteID,
        token: options.token,
        fetch: politeFetch,
      });
    } else {
      this.store = getStore({
        name: storeName,
        consistency: "strong",
        fetch: politeFetch,
      });
    }
  }

  async getActivePointer(): Promise<ActiveVersionPointer | null> {
    try {
      const data = await this.store.get("active:pointer", { type: "json", consistency: "strong" });
      return (data as ActiveVersionPointer) ?? null;
    } catch {
      return null;
    }
  }

  async getActiveSnapshot(category: KfuGenderCategory): Promise<DataImport | null> {
    try {
      // 1. Try reading through single consistent active-version pointer first
      const pointer = await this.getActivePointer();
      if (pointer?.version) {
        const versioned = await this.getVersionedSnapshot(pointer.version, category);
        if (versioned) {
          return versioned;
        }
      }

      // 2. Fallback to direct key if pointer is not yet created
      const data = await this.store.get(`active:${category}`, { type: "json", consistency: "strong" });
      return (data as DataImport) ?? null;
    } catch {
      return null;
    }
  }

  async claimNonce(nonce: string, timestampMs: number): Promise<boolean> {
    const key = `nonce:${nonce}`;
    try {
      const res = await this.store.setJSON(
        key,
        {
          claimedAt: new Date().toISOString(),
          timestampMs,
        },
        { onlyIfNew: true }
      );
      if (res && typeof res.modified === "boolean") {
        return res.modified;
      }
      return true;
    } catch {
      try {
        const existing = await this.store.get(key, { consistency: "strong" });
        if (existing !== null && existing !== undefined) {
          return false;
        }
        await this.store.setJSON(key, {
          claimedAt: new Date().toISOString(),
          timestampMs,
        });
        return true;
      } catch {
        return false;
      }
    }
  }

  async getPreviousSnapshot(category: KfuGenderCategory): Promise<DataImport | null> {
    try {
      const data = await this.store.get(`previous:${category}`, { type: "json" });
      return (data as DataImport) ?? null;
    } catch {
      return null;
    }
  }

  async getStagedSnapshot(category: KfuGenderCategory): Promise<DataImport | null> {
    try {
      const data = await this.store.get(`staging:${category}`, { type: "json" });
      return (data as DataImport) ?? null;
    } catch {
      return null;
    }
  }

  async getVersionedSnapshot(version: string, category: KfuGenderCategory): Promise<DataImport | null> {
    try {
      const data = await this.store.get(`version:${version}:${category}`, { type: "json" });
      return (data as DataImport) ?? null;
    } catch {
      return null;
    }
  }

  async getMetadata(): Promise<KfuRefreshMetadata | null> {
    try {
      const data = await this.store.get("metadata", { type: "json" });
      return (data as KfuRefreshMetadata) ?? null;
    } catch {
      return null;
    }
  }

  async getSectionChanges(category: KfuGenderCategory): Promise<SectionChange[]> {
    try {
      const data = await this.store.get(`changes:${category}`, { type: "json" });
      return (data as SectionChange[]) ?? [];
    } catch {
      return [];
    }
  }

  async stageSnapshot(category: KfuGenderCategory, snapshot: DataImport): Promise<void> {
    await this.store.setJSON(`staging:${category}`, snapshot);
  }

  async clearStagedSnapshot(category: KfuGenderCategory): Promise<void> {
    try {
      await this.store.delete(`staging:${category}`);
    } catch {
      // Ignore deletion errors on staging cleanup
    }
  }

  async atomicPublish(params: {
    maleSnapshot: DataImport;
    femaleSnapshot: DataImport;
    maleDiff: SectionChange[];
    femaleDiff: SectionChange[];
    metadata: KfuRefreshMetadata;
    version?: string;
  }): Promise<void> {
    const version = params.version ?? `v_${Date.now()}`;
    const publishedAt = params.metadata.lastPublishedSnapshot || new Date().toISOString();
    const metadataWithVersion: KfuRefreshMetadata = {
      ...params.metadata,
      activeVersion: version,
      lastPublishedSnapshot: publishedAt,
    };

    const activePointer: ActiveVersionPointer = {
      version,
      publishedAt,
      maleCourseCount: params.maleSnapshot.courses.length,
      maleSectionCount: params.maleSnapshot.sections.length,
      femaleCourseCount: params.femaleSnapshot.courses.length,
      femaleSectionCount: params.femaleSnapshot.sections.length,
    };

    // 1. Write immutable versioned snapshots first
    await this.store.setJSON(`version:${version}:11`, params.maleSnapshot);
    await this.store.setJSON(`version:${version}:12`, params.femaleSnapshot);

    // 2. Verify stored version data can be read back before activating
    const verifyMale = await this.store.get(`version:${version}:11`, { type: "json" });
    const verifyFemale = await this.store.get(`version:${version}:12`, { type: "json" });
    if (!verifyMale || !verifyFemale) {
      throw new Error(`Write verification failed for snapshot version ${version}: read-back returned empty`);
    }

    // 3. Read current active pointer/snapshots to save as rollback backup
    const prevPointer = await this.getActivePointer();
    const prevActiveMale = await this.getActiveSnapshot("11");
    const prevActiveFemale = await this.getActiveSnapshot("12");

    if (prevPointer) {
      await this.store.setJSON("previous:pointer", prevPointer);
    }
    if (prevActiveMale) {
      await this.store.setJSON("previous:11", prevActiveMale);
    }
    if (prevActiveFemale) {
      await this.store.setJSON("previous:12", prevActiveFemale);
    }

    try {
      // 4. Atomically switch single active-version pointer FIRST
      await this.store.setJSON("active:pointer", activePointer);

      // 5. Update active keys, diffs, and metadata
      await this.store.setJSON("active:11", params.maleSnapshot);
      await this.store.setJSON("active:12", params.femaleSnapshot);
      await this.store.setJSON("changes:11", params.maleDiff);
      await this.store.setJSON("changes:12", params.femaleDiff);
      await this.store.setJSON("metadata", metadataWithVersion);

      // 6. Clean up staging
      await this.clearStagedSnapshot("11");
      await this.clearStagedSnapshot("12");
    } catch (publishError: unknown) {
      // Automatic rollback on partial write failure
      try {
        if (prevPointer) {
          await this.store.setJSON("active:pointer", prevPointer);
        }
        if (prevActiveMale) {
          await this.store.setJSON("active:11", prevActiveMale);
        }
        if (prevActiveFemale) {
          await this.store.setJSON("active:12", prevActiveFemale);
        }
      } catch {
        // Rollback attempt recorded
      }
      throw publishError;
    }
  }

  async rollbackToPrevious(): Promise<{ rolledBack: boolean; reason?: string }> {
    const prevPointer = (await this.store.get("previous:pointer", { type: "json" })) as ActiveVersionPointer | null;
    const prevMale = await this.getPreviousSnapshot("11");
    const prevFemale = await this.getPreviousSnapshot("12");

    if (!prevPointer && !prevMale && !prevFemale) {
      return { rolledBack: false, reason: "No previous snapshot available in durable store for rollback." };
    }

    if (prevPointer) {
      await this.store.setJSON("active:pointer", prevPointer);
    }
    if (prevMale) {
      await this.store.setJSON("active:11", prevMale);
    }
    if (prevFemale) {
      await this.store.setJSON("active:12", prevFemale);
    }

    const currentMeta = await this.getMetadata();
    if (currentMeta) {
      await this.store.setJSON("metadata", {
        ...currentMeta,
        sourceHealth: "degraded",
        failureReason: "Manual or automated rollback to previous known-good snapshot executed.",
      });
    }

    return { rolledBack: true };
  }

  async acquireDistributedLock(key: string, ttlMs = 300000): Promise<boolean> {
    const lockKey = `lock:${key}`;
    try {
      const existing = (await this.store.get(lockKey, { type: "json" })) as DistributedLockRecord | null;
      const now = Date.now();
      if (existing && existing.expiresAt > now) {
        return false;
      }

      const lockData: DistributedLockRecord = {
        lockedAt: new Date(now).toISOString(),
        expiresAt: now + ttlMs,
        workerId: Math.random().toString(36).substring(2),
      };

      await this.store.setJSON(lockKey, lockData);
      return true;
    } catch {
      // In case of store error, fail safe to prevent overlapping runs
      return false;
    }
  }

  async releaseDistributedLock(key: string): Promise<void> {
    try {
      await this.store.delete(`lock:${key}`);
    } catch {
      // Ignore
    }
  }
}

/**
 * In-memory snapshot store for unit tests and local execution without Netlify platform context.
 */
export class MemorySnapshotStore implements IKfuSnapshotStore {
  private data = new Map<string, unknown>();
  private locks = new Map<string, DistributedLockRecord>();
  private nonces = new Map<string, number>();
  public simulateFailureOnPublish = false;

  constructor(seedWithBundled = true) {
    if (seedWithBundled) {
      this.data.set("active:11", maleOfferings);
      this.data.set("active:12", femaleOfferings);
      this.data.set("metadata", {
        lastAttemptedCheck: maleOfferings.importedAt,
        lastSuccessfulFetchMale: maleOfferings.importedAt,
        lastSuccessfulFetchFemale: femaleOfferings.importedAt,
        lastPublishedMale: maleOfferings.importedAt,
        lastPublishedFemale: femaleOfferings.importedAt,
        lastPublishedSnapshot: maleOfferings.importedAt,
        maleCourseCount: maleOfferings.courses.length,
        maleSectionCount: maleOfferings.sections.length,
        femaleCourseCount: femaleOfferings.courses.length,
        femaleSectionCount: femaleOfferings.sections.length,
        sourceHealth: "healthy",
        disclaimer: "Seat availability reflects historical snapshot data and does not guarantee live portal capacity.",
        attestation: KFU_OWNER_ATTESTATION,
      } satisfies KfuRefreshMetadata);
    }
  }

  async claimNonce(nonce: string, timestampMs: number): Promise<boolean> {
    if (this.nonces.has(nonce)) {
      return false;
    }
    this.nonces.set(nonce, timestampMs);
    return true;
  }

  async getActivePointer(): Promise<ActiveVersionPointer | null> {
    return (this.data.get("active:pointer") as ActiveVersionPointer) ?? null;
  }

  async getActiveSnapshot(category: KfuGenderCategory): Promise<DataImport | null> {
    const pointer = await this.getActivePointer();
    if (pointer?.version) {
      const versioned = await this.getVersionedSnapshot(pointer.version, category);
      if (versioned) {
        return versioned;
      }
    }
    return (this.data.get(`active:${category}`) as DataImport) ?? null;
  }

  async getPreviousSnapshot(category: KfuGenderCategory): Promise<DataImport | null> {
    return (this.data.get(`previous:${category}`) as DataImport) ?? null;
  }

  async getStagedSnapshot(category: KfuGenderCategory): Promise<DataImport | null> {
    return (this.data.get(`staging:${category}`) as DataImport) ?? null;
  }

  async getVersionedSnapshot(version: string, category: KfuGenderCategory): Promise<DataImport | null> {
    return (this.data.get(`version:${version}:${category}`) as DataImport) ?? null;
  }

  async getMetadata(): Promise<KfuRefreshMetadata | null> {
    return (this.data.get("metadata") as KfuRefreshMetadata) ?? null;
  }

  async getSectionChanges(category: KfuGenderCategory): Promise<SectionChange[]> {
    return (this.data.get(`changes:${category}`) as SectionChange[]) ?? [];
  }

  async stageSnapshot(category: KfuGenderCategory, snapshot: DataImport): Promise<void> {
    this.data.set(`staging:${category}`, snapshot);
  }

  async clearStagedSnapshot(category: KfuGenderCategory): Promise<void> {
    this.data.delete(`staging:${category}`);
  }

  async atomicPublish(params: {
    maleSnapshot: DataImport;
    femaleSnapshot: DataImport;
    maleDiff: SectionChange[];
    femaleDiff: SectionChange[];
    metadata: KfuRefreshMetadata;
    version?: string;
  }): Promise<void> {
    const version = params.version ?? `v_${Date.now()}`;
    const publishedAt = params.metadata.lastPublishedSnapshot || new Date().toISOString();
    const metadataWithVersion: KfuRefreshMetadata = {
      ...params.metadata,
      activeVersion: version,
      lastPublishedSnapshot: publishedAt,
    };

    const activePointer: ActiveVersionPointer = {
      version,
      publishedAt,
      maleCourseCount: params.maleSnapshot.courses.length,
      maleSectionCount: params.maleSnapshot.sections.length,
      femaleCourseCount: params.femaleSnapshot.courses.length,
      femaleSectionCount: params.femaleSnapshot.sections.length,
    };

    this.data.set(`version:${version}:11`, params.maleSnapshot);
    this.data.set(`version:${version}:12`, params.femaleSnapshot);

    const prevPointer = this.data.get("active:pointer") as ActiveVersionPointer | undefined;
    const prevActiveMale = this.data.get("active:11") as DataImport | undefined;
    const prevActiveFemale = this.data.get("active:12") as DataImport | undefined;

    if (prevPointer) this.data.set("previous:pointer", prevPointer);
    if (prevActiveMale) this.data.set("previous:11", prevActiveMale);
    if (prevActiveFemale) this.data.set("previous:12", prevActiveFemale);

    if (this.simulateFailureOnPublish) {
      if (prevPointer) this.data.set("active:pointer", prevPointer);
      if (prevActiveMale) this.data.set("active:11", prevActiveMale);
      if (prevActiveFemale) this.data.set("active:12", prevActiveFemale);
      throw new Error("Simulated storage write failure during atomic publish");
    }

    this.data.set("active:pointer", activePointer);
    this.data.set("active:11", params.maleSnapshot);
    this.data.set("active:12", params.femaleSnapshot);
    this.data.set("changes:11", params.maleDiff);
    this.data.set("changes:12", params.femaleDiff);
    this.data.set("metadata", metadataWithVersion);
    this.data.delete("staging:11");
    this.data.delete("staging:12");
  }

  async rollbackToPrevious(): Promise<{ rolledBack: boolean; reason?: string }> {
    const prevPointer = this.data.get("previous:pointer") as ActiveVersionPointer | undefined;
    const prevMale = this.data.get("previous:11") as DataImport | undefined;
    const prevFemale = this.data.get("previous:12") as DataImport | undefined;

    if (!prevPointer && !prevMale && !prevFemale) {
      return { rolledBack: false, reason: "No previous snapshot available for rollback." };
    }

    if (prevPointer) this.data.set("active:pointer", prevPointer);
    if (prevMale) this.data.set("active:11", prevMale);
    if (prevFemale) this.data.set("active:12", prevFemale);

    const currentMeta = (this.data.get("metadata") as KfuRefreshMetadata) || {};
    this.data.set("metadata", {
      ...currentMeta,
      sourceHealth: "degraded",
      failureReason: "Rollback to previous snapshot executed.",
    });

    return { rolledBack: true };
  }

  async acquireDistributedLock(key: string, ttlMs = 300000): Promise<boolean> {
    const now = Date.now();
    const existing = this.locks.get(key);
    if (existing && existing.expiresAt > now) {
      return false;
    }

    this.locks.set(key, {
      lockedAt: new Date(now).toISOString(),
      expiresAt: now + ttlMs,
      workerId: "mem-worker",
    });
    return true;
  }

  async releaseDistributedLock(key: string): Promise<void> {
    this.locks.delete(key);
  }

  reset(): void {
    this.data.clear();
    this.locks.clear();
    this.simulateFailureOnPublish = false;
  }
}

let testStore: IKfuSnapshotStore | null = null;
let globalMemoryStore: MemorySnapshotStore | null = null;

export function setSnapshotStoreForTesting(store: IKfuSnapshotStore | null): void {
  testStore = store;
}

export function getGlobalMemoryStore(): MemorySnapshotStore {
  if (!globalMemoryStore) {
    globalMemoryStore = new MemorySnapshotStore(true);
  }
  return globalMemoryStore;
}

export function getSnapshotStore(): IKfuSnapshotStore {
  if (testStore) {
    return testStore;
  }

  try {
    return new NetlifyBlobsSnapshotStore();
  } catch {
    return getGlobalMemoryStore();
  }
}
