import { NextResponse } from "next/server";
import { getSnapshotStore } from "@/lib/kfu-monitor/storage";
import { maleOfferings, femaleOfferings } from "@/data/offerings";
import type { KfuGenderCategory } from "@/lib/kfu-monitor/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let categoryParam: string | null = null;
  try {
    const url = new URL(request.url, "http://localhost");
    categoryParam = url.searchParams.get("category");
  } catch {
    categoryParam = null;
  }

  const category: KfuGenderCategory =
    categoryParam === "12" || categoryParam === "female" ? "12" : "11";

  try {
    const store = getSnapshotStore();
    const active = await store.getActiveSnapshot(category);
    const metadata = await store.getMetadata();
    const pointer = await store.getActivePointer();

    const snapshot = active ?? (category === "12" ? femaleOfferings : maleOfferings);

    const versionTag = pointer?.version ?? metadata?.activeVersion ?? "144820-base";
    const etag = `W/"${versionTag}-${category}"`;
    const clientIfNoneMatch = request.headers.get("if-none-match");

    const cacheHeaders = {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
      "ETag": etag,
      "Netlify-Vary": "query=category",
    };

    if (clientIfNoneMatch && (clientIfNoneMatch === etag || clientIfNoneMatch === `"${versionTag}-${category}"`)) {
      return new NextResponse(null, {
        status: 304,
        headers: cacheHeaders,
      });
    }

    return NextResponse.json(
      {
        snapshot,
        metadata: metadata ?? undefined,
        activePointer: pointer ?? undefined,
        version: pointer?.version ?? metadata?.activeVersion,
        source: active ? "durable_storage" : "bundled_fallback",
        requestedCategory: category,
      },
      {
        status: 200,
        headers: cacheHeaders,
      },
    );
  } catch (error: unknown) {
    const fallback = category === "12" ? femaleOfferings : maleOfferings;
    return NextResponse.json(
      {
        snapshot: fallback,
        source: "bundled_fallback_error",
        requestedCategory: category,
        error: error instanceof Error ? error.message : "Failed to read durable storage",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=30",
        },
      },
    );
  }
}
