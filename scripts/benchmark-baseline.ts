import { performance } from "perf_hooks";
import { maleOfferings, femaleOfferings } from "../src/data/offerings";
import { generateSchedules, DEFAULT_AUTO_SCHEDULE_PREFERENCES } from "../src/lib/auto-schedule";
import { normalizeSearchText } from "../src/lib/search-normalizer";

async function measureHttp(name: string, url: string) {
  const times: number[] = [];
  let size = 0;
  let status = 0;
  let encoding = "";

  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    const res = await fetch(url, {
      headers: { "Accept-Encoding": "gzip, deflate, br" },
      signal: AbortSignal.timeout(10000),
    });
    const buf = await res.arrayBuffer();
    const end = performance.now();
    times.push(end - start);
    size = buf.byteLength;
    status = res.status;
    encoding = res.headers.get("content-encoding") || "none";
  }

  times.sort((a, b) => a - b);
  const p50 = times[2];
  const p95 = times[4];
  const avg = times.reduce((s, x) => s + x, 0) / times.length;

  return {
    name,
    url,
    status,
    transferSizeBytes: size,
    transferSizeKb: (size / 1024).toFixed(1) + " KB",
    encoding,
    p50Ms: p50.toFixed(1),
    p95Ms: p95.toFixed(1),
    avgMs: avg.toFixed(1),
  };
}

async function runBaseline() {
  console.log("=== LEMON-046: BASELINE PERFORMANCE MEASUREMENTS ===\n");

  const prod = "https://yourcampuspallemon.netlify.app";

  console.log("--- 1. Production HTTP Latency & Transfer Sizes (5 samples each) ---");
  const httpTargets = [
    { name: "Root Homepage (SSR/Static HTML)", url: prod + "/" },
    { name: "KFU Status Endpoint", url: prod + "/api/kfu/status" },
    { name: "Male Snapshot Endpoint", url: prod + "/api/kfu/snapshot?category=11" },
    { name: "Female Snapshot Endpoint", url: prod + "/api/kfu/snapshot?category=12" },
    { name: "GPA Page (HTML)", url: prod + "/gpa" },
  ];

  const httpResults = [];
  for (const t of httpTargets) {
    try {
      const res = await measureHttp(t.name, t.url);
      httpResults.push(res);
      console.log(
        `✓ ${res.name.padEnd(35)}: ${res.transferSizeKb.padStart(10)} (${res.encoding.padEnd(4)}) | p50: ${res.p50Ms.padStart(5)}ms | p95: ${res.p95Ms.padStart(5)}ms`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`✗ ${t.name}: ${message}`);
    }
  }

  console.log("\n--- 2. Course Catalog Search & Filter Micro-Benchmarks ---");
  // Test both male (389 sections) and female (540 sections)
  for (const [gender, dataset] of [
    ["Male (389 sections)", maleOfferings],
    ["Female (540 sections)", femaleOfferings],
  ] as const) {
    const queries = ["محاسبة", "ACCT", "101", "عبدالله", "TBA", "نظم المعلومات"];
    const searchTimes: number[] = [];

    for (let i = 0; i < 1000; i++) {
      const q = queries[i % queries.length];
      const start = performance.now();
      const normQ = normalizeSearchText(q);
      void dataset.sections.filter((s) => {
        const course = dataset.courses.find((c) => c.id === s.courseId);
        if (!course) return false;
        const normCode = normalizeSearchText(course.code);
        const normTitle = normalizeSearchText(course.titleEn ?? course.titleAr);
        const normInstr = s.instructor ? normalizeSearchText(s.instructor.name) : "";
        return (
          normCode.includes(normQ) ||
          normTitle.includes(normQ) ||
          normInstr.includes(normQ) ||
          s.crn.includes(normQ)
        );
      });
      const end = performance.now();
      searchTimes.push(end - start);
    }

    searchTimes.sort((a, b) => a - b);
    const p50 = searchTimes[Math.floor(searchTimes.length * 0.5)];
    const p95 = searchTimes[Math.floor(searchTimes.length * 0.95)];
    const p99 = searchTimes[Math.floor(searchTimes.length * 0.99)];
    console.log(
      `✓ Catalog Filter ${gender.padEnd(22)} (1000 runs): p50: ${p50.toFixed(3)}ms | p95: ${p95.toFixed(3)}ms | p99: ${p99.toFixed(3)}ms`
    );
  }

  console.log("\n--- 3. Auto Schedule Engine Generation Benchmarks ---");
  // Benchmark Auto Schedule candidate generation on realistic course selections (3 to 6 courses)
  for (const courseCount of [3, 4, 5, 6]) {
    const selectedCourseIds = maleOfferings.courses.slice(0, courseCount).map((c) => c.id);

    const genTimes: number[] = [];
    let candidateCount = 0;

    for (let i = 0; i < 50; i++) {
      const start = performance.now();
      const result = generateSchedules(
        maleOfferings,
        selectedCourseIds,
        {
          ...DEFAULT_AUTO_SCHEDULE_PREFERENCES,
          resultCount: 5,
        }
      );
      const end = performance.now();
      genTimes.push(end - start);
      candidateCount = result.schedules.length;
    }

    genTimes.sort((a, b) => a - b);
    const p50 = genTimes[Math.floor(genTimes.length * 0.5)];
    const p95 = genTimes[Math.floor(genTimes.length * 0.95)];
    console.log(
      `✓ AutoSchedule (${courseCount} courses -> ${candidateCount.toString().padStart(2)} plans): p50: ${p50.toFixed(2)}ms | p95: ${p95.toFixed(2)}ms`
    );
  }

  // Combinatorial stress: 5 courses with largest section pools
  const heavyCourseIds = [...maleOfferings.courses]
    .map((c) => ({
      id: c.id,
      sectionsCount: maleOfferings.sections.filter((s) => s.courseId === c.id).length,
    }))
    .sort((a, b) => b.sectionsCount - a.sectionsCount)
    .slice(0, 5)
    .map((x) => x.id);

  const heavyTimes: number[] = [];
  let heavyResultCount = 0;
  for (let i = 0; i < 30; i++) {
    const start = performance.now();
    const result = generateSchedules(
      maleOfferings,
      heavyCourseIds,
      {
        ...DEFAULT_AUTO_SCHEDULE_PREFERENCES,
        resultCount: 20,
        hardDaysOff: ["thu"],
        openOnly: false,
      }
    );
    const end = performance.now();
    heavyTimes.push(end - start);
    heavyResultCount = result.schedules.length;
  }
  heavyTimes.sort((a, b) => a - b);
  console.log(
    `✓ Heavy AutoSchedule (5 dense courses -> ${heavyResultCount} plans): p50: ${heavyTimes[Math.floor(heavyTimes.length * 0.5)].toFixed(2)}ms | p95: ${heavyTimes[Math.floor(heavyTimes.length * 0.95)].toFixed(2)}ms`
  );

  console.log("\n=== BASELINE BENCHMARK COMPLETE ===");
}

runBaseline().catch((e) => console.error("Baseline benchmark failed:", e));
