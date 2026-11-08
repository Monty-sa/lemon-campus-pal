import { performance } from "perf_hooks";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { maleOfferings, femaleOfferings } from "../src/data/offerings";
import { generateSchedules, DEFAULT_AUTO_SCHEDULE_PREFERENCES } from "../src/lib/auto-schedule";
import { normalizeSearchText } from "../src/lib/search-normalizer";
import { calculateSemesterGpa, calculateProjectedCumulativeGpa, calculateTargetGpaFeasibility } from "../src/lib/gpa/calculator";
import type { GpaCourseInput } from "../src/lib/gpa/types";
import { DataImportSchema } from "../src/lib/schema";

const PROD_URL = "https://yourcampuspallemon.netlify.app";

async function measureHttpEndpoint(url: string, iterations = 10) {
  const times: number[] = [];
  const ttfbs: number[] = [];
  let compressedBytes = 0;
  let encoding = "none";
  let cacheControl = "";
  let etag = "";

  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    const res = await fetch(url, {
      headers: {
        "Accept-Encoding": "gzip, deflate, br",
        "User-Agent": "LEMON-Lightspeed-Benchmark/1.0"
      },
      signal: AbortSignal.timeout(10000)
    });
    const ttfb = performance.now() - t0;
    ttfbs.push(ttfb);

    const buf = await res.arrayBuffer();
    const totalTime = performance.now() - t0;
    times.push(totalTime);

    if (i === 0) {
      compressedBytes = buf.byteLength;
      encoding = res.headers.get("content-encoding") || "none";
      cacheControl = res.headers.get("cache-control") || "none";
      etag = res.headers.get("etag") || "none";
    }
  }

  times.sort((a, b) => a - b);
  ttfbs.sort((a, b) => a - b);

  return {
    url,
    status: 200,
    encoding,
    cacheControl,
    etag,
    compressedBytes,
    compressedKb: (compressedBytes / 1024).toFixed(1),
    coldTtfbMs: ttfbs[0].toFixed(1),
    medianTtfbMs: ttfbs[Math.floor(ttfbs.length / 2)].toFixed(1),
    p95TtfbMs: ttfbs[Math.floor(ttfbs.length * 0.95)].toFixed(1),
    coldTotalMs: times[0].toFixed(1),
    medianTotalMs: times[Math.floor(times.length / 2)].toFixed(1),
    p95TotalMs: times[Math.floor(times.length * 0.95)].toFixed(1),
  };
}

function analyzeStaticBundles() {
  const chunksDir = path.join(".next", "static", "chunks");
  const cssDir = path.join(".next", "static", "css");

  const bundles: { name: string; type: string; rawBytes: number; gzipBytes: number; brBytes: number }[] = [];

  function processDir(dir: string) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const full = path.join(dir, f);
      const stat = fs.statSync(full);
      if (stat.isFile() && (f.endsWith(".js") || f.endsWith(".css"))) {
        const type = f.endsWith(".css") ? "css" : "js";
        const raw = fs.readFileSync(full);
        const gzip = zlib.gzipSync(raw);
        const br = zlib.brotliCompressSync(raw);
        bundles.push({
          name: f,
          type,
          rawBytes: raw.length,
          gzipBytes: gzip.length,
          brBytes: br.length,
        });
      }
    }
  }

  processDir(chunksDir);
  processDir(cssDir);

  bundles.sort((a, b) => b.rawBytes - a.rawBytes);
  return bundles;
}

function benchmarkZodParse() {
  const maleJson = JSON.parse(fs.readFileSync("data/kfu-144820-06-11.json", "utf8"));
  const femaleJson = JSON.parse(fs.readFileSync("data/kfu-144820-06-12.json", "utf8"));

  const timesMale: number[] = [];
  const timesFemale: number[] = [];

  for (let i = 0; i < 20; i++) {
    const t0 = performance.now();
    DataImportSchema.parse(maleJson);
    timesMale.push(performance.now() - t0);

    const t1 = performance.now();
    DataImportSchema.parse(femaleJson);
    timesFemale.push(performance.now() - t1);
  }

  timesMale.sort((a, b) => a - b);
  timesFemale.sort((a, b) => a - b);

  return {
    maleZodParseMedianMs: timesMale[Math.floor(timesMale.length / 2)].toFixed(2),
    maleZodParseP95Ms: timesMale[Math.floor(timesMale.length * 0.95)].toFixed(2),
    femaleZodParseMedianMs: timesFemale[Math.floor(timesFemale.length / 2)].toFixed(2),
    femaleZodParseP95Ms: timesFemale[Math.floor(timesFemale.length * 0.95)].toFixed(2),
  };
}

function benchmarkCatalogSearch() {
  const queries = ["محاسبة", "ACCT", "101", "عبدالله", "TBA", "نظم المعلومات", "تسويق", "Finance", "LAW", "إدارة"];
  const maleTimes: number[] = [];
  const femaleTimes: number[] = [];

  for (let i = 0; i < 500; i++) {
    const q = queries[i % queries.length];
    const normQ = normalizeSearchText(q);

    const t0 = performance.now();
    maleOfferings.sections.filter((s) => {
      const course = maleOfferings.courses.find((c) => c.id === s.courseId);
      if (!course) return false;
      return (
        normalizeSearchText(course.code).includes(normQ) ||
        normalizeSearchText(course.titleAr).includes(normQ) ||
        (course.titleEn ? normalizeSearchText(course.titleEn).includes(normQ) : false) ||
        (s.instructor ? normalizeSearchText(s.instructor.name).includes(normQ) : false) ||
        s.crn.includes(normQ)
      );
    });
    maleTimes.push(performance.now() - t0);

    const t1 = performance.now();
    femaleOfferings.sections.filter((s) => {
      const course = femaleOfferings.courses.find((c) => c.id === s.courseId);
      if (!course) return false;
      return (
        normalizeSearchText(course.code).includes(normQ) ||
        normalizeSearchText(course.titleAr).includes(normQ) ||
        (course.titleEn ? normalizeSearchText(course.titleEn).includes(normQ) : false) ||
        (s.instructor ? normalizeSearchText(s.instructor.name).includes(normQ) : false) ||
        s.crn.includes(normQ)
      );
    });
    femaleTimes.push(performance.now() - t1);
  }

  maleTimes.sort((a, b) => a - b);
  femaleTimes.sort((a, b) => a - b);

  return {
    maleFilterP50Ms: maleTimes[Math.floor(maleTimes.length / 2)].toFixed(3),
    maleFilterP95Ms: maleTimes[Math.floor(maleTimes.length * 0.95)].toFixed(3),
    femaleFilterP50Ms: femaleTimes[Math.floor(femaleTimes.length / 2)].toFixed(3),
    femaleFilterP95Ms: femaleTimes[Math.floor(femaleTimes.length * 0.95)].toFixed(3),
  };
}

function benchmarkAutoSchedule() {
  const courseCounts = [3, 4, 5, 6];
  const results: Record<number, { p50Ms: string; p95Ms: string; candidates: number }> = {};

  for (const count of courseCounts) {
    const courseIds = maleOfferings.courses.slice(0, count).map((c) => c.id);
    const times: number[] = [];
    let candCount = 0;

    for (let i = 0; i < 30; i++) {
      const t0 = performance.now();
      const res = generateSchedules(maleOfferings, courseIds, {
        ...DEFAULT_AUTO_SCHEDULE_PREFERENCES,
        resultCount: 5,
        openOnly: false
      });
      times.push(performance.now() - t0);
      candCount = res.schedules.length;
    }

    times.sort((a, b) => a - b);
    results[count] = {
      p50Ms: times[Math.floor(times.length / 2)].toFixed(2),
      p95Ms: times[Math.floor(times.length * 0.95)].toFixed(2),
      candidates: candCount
    };
  }

  return results;
}

function benchmarkGpaEngine() {
  const sampleCourses: GpaCourseInput[] = [
    { id: "1", code: "ACCT 101", credits: 3, grade: "A+" },
    { id: "2", code: "MGMT 102", credits: 3, grade: "B+" },
    { id: "3", code: "ECON 201", credits: 3, grade: "A" },
    { id: "4", code: "MIS 202", credits: 3, grade: "C+" },
    { id: "5", code: "MATH 105", credits: 3, grade: "B" },
  ];

  const times: number[] = [];
  for (let i = 0; i < 1000; i++) {
    const t0 = performance.now();
    const sem = calculateSemesterGpa(sampleCourses);
    calculateProjectedCumulativeGpa(
      { previousGpa: 4.25, previousHours: 45 },
      sem
    );
    calculateTargetGpaFeasibility(
      { previousGpa: 4.25, previousHours: 45 },
      sem.gpaCredits,
      4.5
    );
    times.push(performance.now() - t0);
  }

  times.sort((a, b) => a - b);
  return {
    gpaCalcP50Ms: times[Math.floor(times.length / 2)].toFixed(4),
    gpaCalcP95Ms: times[Math.floor(times.length * 0.95)].toFixed(4),
  };
}

async function runFullBenchmark() {
  console.log("=== LEMON LIGHTSPEED: MEASURING PRODUCTION BASELINE ===");

  console.log("\n1. Measuring Production HTTP Network Waterfalls...");
  const endpoints = [
    { label: "Homepage Document (HTML)", url: `${PROD_URL}/` },
    { label: "GPA Route Document (HTML)", url: `${PROD_URL}/gpa` },
    { label: "KFU Status Endpoint", url: `${PROD_URL}/api/kfu/status` },
    { label: "Male Snapshot (Category 11)", url: `${PROD_URL}/api/kfu/snapshot?category=11` },
    { label: "Female Snapshot (Category 12)", url: `${PROD_URL}/api/kfu/snapshot?category=12` },
  ];

  const httpResults = [];
  for (const ep of endpoints) {
    try {
      console.log(`  Probing ${ep.label}...`);
      const res = await measureHttpEndpoint(ep.url, 10);
      httpResults.push({ ...ep, ...res });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  Failed to probe ${ep.label}:`, msg);
    }
  }

  console.log("\n2. Analyzing Static JavaScript & CSS Bundles...");
  const bundles = analyzeStaticBundles();
  const totalJsRaw = bundles.filter(b => b.type === "js").reduce((acc, b) => acc + b.rawBytes, 0);
  const totalJsGzip = bundles.filter(b => b.type === "js").reduce((acc, b) => acc + b.gzipBytes, 0);
  const totalJsBr = bundles.filter(b => b.type === "js").reduce((acc, b) => acc + b.brBytes, 0);

  const totalCssRaw = bundles.filter(b => b.type === "css").reduce((acc, b) => acc + b.rawBytes, 0);
  const totalCssGzip = bundles.filter(b => b.type === "css").reduce((acc, b) => acc + b.gzipBytes, 0);
  const totalCssBr = bundles.filter(b => b.type === "css").reduce((acc, b) => acc + b.brBytes, 0);

  console.log(`  Total JS: ${(totalJsRaw / 1024).toFixed(1)} KB uncompressed | ${(totalJsGzip / 1024).toFixed(1)} KB gzip | ${(totalJsBr / 1024).toFixed(1)} KB brotli`);
  console.log(`  Total CSS: ${(totalCssRaw / 1024).toFixed(1)} KB uncompressed | ${(totalCssGzip / 1024).toFixed(1)} KB gzip | ${(totalCssBr / 1024).toFixed(1)} KB brotli`);

  console.log("\n3. Benchmarking Zod Schema Parsing Cost...");
  const zodResults = benchmarkZodParse();
  console.log("  Zod Parse Results:", zodResults);

  console.log("\n4. Benchmarking Course Catalog Search & Filter...");
  const searchResults = benchmarkCatalogSearch();
  console.log("  Search & Filter Results:", searchResults);

  console.log("\n5. Benchmarking Auto Schedule Candidate Generation...");
  const autoScheduleResults = benchmarkAutoSchedule();
  console.log("  Auto Schedule Results:", autoScheduleResults);

  console.log("\n6. Benchmarking GPA Calculation Engine...");
  const gpaResults = benchmarkGpaEngine();
  console.log("  GPA Engine Results:", gpaResults);

  const baselineData = {
    timestamp: new Date().toISOString(),
    productionUrl: PROD_URL,
    httpResults,
    bundles,
    totals: {
      jsRawKb: (totalJsRaw / 1024).toFixed(1),
      jsGzipKb: (totalJsGzip / 1024).toFixed(1),
      jsBrKb: (totalJsBr / 1024).toFixed(1),
      cssRawKb: (totalCssRaw / 1024).toFixed(1),
      cssGzipKb: (totalCssGzip / 1024).toFixed(1),
      cssBrKb: (totalCssBr / 1024).toFixed(1),
    },
    zodResults,
    searchResults,
    autoScheduleResults,
    gpaResults,
  };

  fs.writeFileSync("docs/PERFORMANCE_BASELINE.json", JSON.stringify(baselineData, null, 2));
  console.log("\n✓ Saved raw baseline metrics to docs/PERFORMANCE_BASELINE.json");
}

runFullBenchmark().catch(e => console.error("Benchmark failed:", e));
