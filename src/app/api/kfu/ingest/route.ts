import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSnapshotStore } from "@/lib/kfu-monitor/storage";
import { validateSnapshotCompleteness } from "@/lib/kfu-monitor/validator";
import { computeSnapshotDiff } from "@/lib/kfu-monitor/diff";
import {
  KFU_BUSINESS_DATASETS,
  KFU_OWNER_ATTESTATION,
  type KfuIngestPayload,
  type KfuIngestResponse,
  type KfuRefreshMetadata,
} from "@/lib/kfu-monitor/types";
import { maleOfferings, femaleOfferings } from "@/data/offerings";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.KFU_INGESTION_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Ingestion service not configured on server (missing KFU_INGESTION_SECRET)" },
      { status: 500 },
    );
  }

  // 1. Extract and validate required security headers
  const timestampHeader = request.headers.get("x-lemon-timestamp");
  const nonce = request.headers.get("x-lemon-nonce");
  const providedSignature = request.headers.get("x-lemon-signature");

  if (!timestampHeader || !nonce || !providedSignature) {
    return NextResponse.json(
      { error: "Missing required security headers (x-lemon-timestamp, x-lemon-nonce, x-lemon-signature)" },
      { status: 401 },
    );
  }

  // 2. Validate timestamp freshness (5-minute replay window)
  const timestampMs = Date.parse(timestampHeader);
  if (isNaN(timestampMs)) {
    return NextResponse.json({ error: "Invalid x-lemon-timestamp format" }, { status: 400 });
  }

  const now = Date.now();
  if (Math.abs(now - timestampMs) > 300_000) {
    return NextResponse.json(
      { error: "Request timestamp outside acceptable window (skew exceeds 5 minutes)" },
      { status: 403 },
    );
  }

  // 3. Read raw body and verify HMAC-SHA256 signature
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Failed to read request payload" }, { status: 400 });
  }

  if (rawBody.length > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "Payload exceeds 15MB limit" }, { status: 413 });
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(`${timestampHeader}:${nonce}:${rawBody}`)
    .digest("hex");

  try {
    const expectedBuf = Buffer.from(expectedSignature, "hex");
    const providedBuf = Buffer.from(providedSignature, "hex");

    if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
      return NextResponse.json({ error: "Invalid HMAC signature" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
  }

  // 4. Durable atomic replay protection across serverless instances
  const store = getSnapshotStore();
  const nonceClaimed = await store.claimNonce(nonce, timestampMs);
  if (!nonceClaimed) {
    return NextResponse.json(
      { error: "Replay attack detected: duplicate nonce already consumed" },
      { status: 403 },
    );
  }

  // 5. Parse and validate JSON payload schema
  let payload: KfuIngestPayload;
  try {
    payload = JSON.parse(rawBody) as KfuIngestPayload;
  } catch {
    return NextResponse.json({ error: "Malformed JSON payload" }, { status: 400 });
  }

  const { maleSnapshot, femaleSnapshot, sourceMetadata } = payload;
  if (!maleSnapshot || !femaleSnapshot || !sourceMetadata?.fetchedAt) {
    return NextResponse.json(
      { error: "Missing required fields in payload (maleSnapshot, femaleSnapshot, sourceMetadata)" },
      { status: 422 },
    );
  }

  // Verify category identity tags
  if (maleSnapshot.studentCategory?.id !== "11" || femaleSnapshot.studentCategory?.id !== "12") {
    return NextResponse.json(
      { error: "Dataset gender category mismatch (male must have id '11', female must have id '12')" },
      { status: 422 },
    );
  }

  // 6. Server-side snapshot validation against baselines
  const prevMale = (await store.getActiveSnapshot("11")) ?? maleOfferings;
  const prevFemale = (await store.getActiveSnapshot("12")) ?? femaleOfferings;

  const maleVal = validateSnapshotCompleteness(maleSnapshot, prevMale, KFU_BUSINESS_DATASETS["11"]);
  const femaleVal = validateSnapshotCompleteness(femaleSnapshot, prevFemale, KFU_BUSINESS_DATASETS["12"]);

  if (!maleVal.isValid) {
    return NextResponse.json(
      {
        error: "Male snapshot validation failed",
        failureReason: maleVal.failureReason,
        warnings: maleVal.warnings,
      },
      { status: 422 },
    );
  }

  if (!femaleVal.isValid) {
    return NextResponse.json(
      {
        error: "Female snapshot validation failed",
        failureReason: femaleVal.failureReason,
        warnings: femaleVal.warnings,
      },
      { status: 422 },
    );
  }

  // 7. Atomic publication to durable storage
  const version = `v_${Date.now()}`;
  const maleDiff = computeSnapshotDiff(prevMale, maleSnapshot);
  const femaleDiff = computeSnapshotDiff(prevFemale, femaleSnapshot);

  const publishedAt = new Date().toISOString();
  const metadata: KfuRefreshMetadata = {
    lastAttemptedCheck: publishedAt,
    lastSuccessfulFetchMale: sourceMetadata.fetchedAt,
    lastSuccessfulFetchFemale: sourceMetadata.fetchedAt,
    lastPublishedMale: sourceMetadata.fetchedAt,
    lastPublishedFemale: sourceMetadata.fetchedAt,
    lastPublishedSnapshot: sourceMetadata.fetchedAt,
    maleCourseCount: maleSnapshot.courses.length,
    maleSectionCount: maleSnapshot.sections.length,
    femaleCourseCount: femaleSnapshot.courses.length,
    femaleSectionCount: femaleSnapshot.sections.length,
    sourceHealth: "healthy",
    refreshSource: "windows_worker",
    activeVersion: version,
    disclaimer: "Seat availability reflects historical snapshot data and does not guarantee live portal capacity.",
    attestation: KFU_OWNER_ATTESTATION,
  };

  try {
    await store.atomicPublish({
      maleSnapshot,
      femaleSnapshot,
      maleDiff,
      femaleDiff,
      metadata,
      version,
    });
  } catch (publishErr: unknown) {
    const errorMsg = publishErr instanceof Error ? publishErr.message : "Atomic publish failed";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }

  const response: KfuIngestResponse = {
    status: "published",
    version,
    publishedAt,
    male: {
      courseCount: maleSnapshot.courses.length,
      sectionCount: maleSnapshot.sections.length,
      changesCount: maleDiff.length,
    },
    female: {
      courseCount: femaleSnapshot.courses.length,
      sectionCount: femaleSnapshot.sections.length,
      changesCount: femaleDiff.length,
    },
    metadata,
  };

  return NextResponse.json(response, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
