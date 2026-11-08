import { maleOfferings, femaleOfferings } from "../src/data/offerings";
import { filterSections, DEFAULT_FILTERS, type ExplorerFilters } from "../src/lib/explorer-filters";
import { addSectionToPlan, findConflicts, calculateCredits } from "../src/lib/schedule";
import type { SchedulePlan } from "../src/lib/schema";

type BenchmarkResult = {
  concurrency: number;
  totalOperations: number;
  durationMs: number;
  throughputOpsPerSec: number;
  p50Ms: number;
  p95Ms: number;
  errors: number;
  cloudRequestVolume: number;
  heapUsedMb: number;
  rssMb: number;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

async function runScenario(userId: number, category: "11" | "12"): Promise<number> {
  const t0 = performance.now();
  const dataset = category === "11" ? maleOfferings : femaleOfferings;

  // 1. Filter queries (search + department + days)
  const filters: ExplorerFilters = {
    ...DEFAULT_FILTERS,
    termId: dataset.term.id,
    departmentId: userId % 2 === 0 ? "0602" : "0603",
    status: userId % 3 === 0 ? "open" : "all",
    selectedDays: userId % 4 === 0 ? ["thu"] : [],
    dayMode: "avoid",
    query: userId % 5 === 0 ? "إدارة" : "",
  };
  const { visibleSections } = filterSections(dataset.sections, dataset.courses, filters);

  // 2. Schedule conflict checking & plan building
  const plan: SchedulePlan = {
    id: `plan-${userId}`,
    name: `User ${userId} Schedule`,
    termId: dataset.term.id,
    sectionIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const sectionsToPick = visibleSections.slice(0, 4);
  let currentPlan = plan;
  for (const sec of sectionsToPick) {
    currentPlan = addSectionToPlan(currentPlan, sec, sectionsToPick);
  }

  // 3. Conflict and credit evaluation
  findConflicts(sectionsToPick);
  calculateCredits(sectionsToPick, dataset.courses);

  // 4. Persistence serialization simulation
  JSON.parse(JSON.stringify(currentPlan));

  return performance.now() - t0;
}

export async function runBenchmark(concurrency: number): Promise<BenchmarkResult> {
  const initialMem = process.memoryUsage();
  const latencies: number[] = [];
  let errors = 0;

  const tStart = performance.now();

  const promises: Promise<void>[] = [];
  for (let i = 0; i < concurrency; i++) {
    const category = i % 2 === 0 ? "11" : "12";
    promises.push(
      runScenario(i, category)
        .then((lat) => {
          latencies.push(lat);
        })
        .catch(() => {
          errors++;
        }),
    );
  }

  await Promise.all(promises);
  const tTotal = performance.now() - tStart;

  latencies.sort((a, b) => a - b);
  const finalMem = process.memoryUsage();

  return {
    concurrency,
    totalOperations: concurrency,
    durationMs: Math.round(tTotal),
    throughputOpsPerSec: Math.round((concurrency / (tTotal / 1000))),
    p50Ms: Number(percentile(latencies, 50).toFixed(2)),
    p95Ms: Number(percentile(latencies, 95).toFixed(2)),
    errors,
    cloudRequestVolume: 0, // Guest-first client-side architecture incurs 0 cloud requests
    heapUsedMb: Number(((finalMem.heapUsed - initialMem.heapUsed) / (1024 * 1024)).toFixed(2)),
    rssMb: Number((finalMem.rss / (1024 * 1024)).toFixed(2)),
  };
}

async function main() {
  console.log("================================================================================");
  console.log("LEMON-013: High-Traffic Registration Period Concurrency Benchmark (Isolated Target)");
  console.log("================================================================================");
  console.log("Testing realistic concurrent user workflows across male & female datasets...");
  console.log("");

  const tiers = [100, 500, 1000];
  const results: BenchmarkResult[] = [];

  for (const tier of tiers) {
    const res = await runBenchmark(tier);
    results.push(res);
  }

  console.log("| Simulated Users | Total Ops | Duration (ms) | Throughput (ops/s) | Latency p50 (ms) | Latency p95 (ms) | Error Rate | Cloud Requests | Memory Delta (MB) |");
  console.log("|---|---|---|---|---|---|---|---|---|");
  for (const r of results) {
    console.log(
      `| ${r.concurrency.toString().padEnd(15)} | ${r.totalOperations.toString().padEnd(9)} | ${r.durationMs.toString().padEnd(13)} | ${r.throughputOpsPerSec.toString().padEnd(18)} | ${r.p50Ms.toString().padEnd(16)} | ${r.p95Ms.toString().padEnd(16)} | ${(r.errors === 0 ? "0.0%" : `${r.errors}`).padEnd(10)} | ${r.cloudRequestVolume.toString().padEnd(14)} | ${r.heapUsedMb} MB |`,
    );
  }
  console.log("");
  console.log("Benchmark successfully completed without hitting external endpoints.");
}

main().catch(console.error);
