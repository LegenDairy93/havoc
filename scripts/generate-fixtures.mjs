import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { DEFAULT_SCENARIO, runRefundExperiment, runScenarioPair, stableStringify } from "../packages/engine/experiment.js";
import { BENCHMARKS, DEFAULT_COMPARISON, runComparison } from "../packages/engine/benchmark.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDir = path.join(root, "fixtures");
await mkdir(fixtureDir, { recursive: true });

for (const policy of ["blind-retry", "reconcile-first"]) {
  const artifact = runRefundExperiment(policy);
  await writeFile(path.join(fixtureDir, `${policy}.json`), stableStringify(artifact), "utf8");
}

const scenarioDir = path.join(fixtureDir, "scenarios");
await mkdir(scenarioDir, { recursive: true });
await writeFile(path.join(scenarioDir, "default.json"), stableStringify(DEFAULT_SCENARIO), "utf8");
await writeFile(path.join(scenarioDir, "default-workbench.json"), stableStringify(runScenarioPair(DEFAULT_SCENARIO)), "utf8");

const comparisonDir = path.join(fixtureDir, "comparisons");
await mkdir(comparisonDir, { recursive: true });
for (const benchmarkId of Object.keys(BENCHMARKS)) await writeFile(path.join(comparisonDir, `${benchmarkId}.json`), stableStringify(runComparison({ ...DEFAULT_COMPARISON, benchmarkId })), "utf8");

console.log("Generated deterministic HAVOC fixtures.");
