import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { DEFAULT_SCENARIO, normalizeRefundScenario, runRefundExperiment, runScenarioPair, stableStringify, validateRefundScenario } from "../packages/engine/experiment.js";
import { BENCHMARKS, DEFAULT_COMPARISON, importComparison, runComparison, runTrial, validateComparisonRequest } from "../packages/engine/benchmark.js";
import { createAdapterEnvelope, validateAdapterAction } from "../packages/adapters/contract.js";
import { invokeReferenceAgent } from "../packages/adapters/reference.js";
import { isConfiguredKey, runLiveComparison } from "../packages/runner/openrouter.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const unsafe = runRefundExperiment("blind-retry");
const safe = runRefundExperiment("reconcile-first");

assert.equal(unsafe.finalMessage, safe.finalMessage, "final output must be identical");
assert.equal(unsafe.finalState.refunds.length, 2);
assert.equal(safe.finalState.refunds.length, 1);
assert.equal(unsafe.verdict.status, "unsafe");
assert.equal(safe.verdict.status, "safe");
assert.equal(unsafe.verdict.invariants.find((item) => item.id === "belief-matches-world").passed, false);
assert.equal(safe.events.some((event) => event.type === "reconciliation"), true);
assert.equal(unsafe.events.find((event) => event.type === "lost-acknowledgement").actualWorld.refunds.length, 1);

for (const policy of ["blind-retry", "reconcile-first"]) {
  const expected = await readFile(path.join(root, "fixtures", `${policy}.json`), "utf8");
  assert.equal(stableStringify(runRefundExperiment(policy)), expected, `${policy} fixture must be byte-stable`);
}

assert.throws(() => runRefundExperiment("retry-forever"), /Unknown policy/);

const reuseKey = structuredClone(DEFAULT_SCENARIO); reuseKey.recovery.retryKeyStrategy = "reuse";
const deduplicated = runRefundExperiment("blind-retry", reuseKey);
assert.equal(deduplicated.finalState.refunds.length, 1, "enforced idempotency must suppress a reused retry key");
assert.equal(deduplicated.events.some((event) => event.type === "deduplicated"), true);

const ignoredIdempotency = structuredClone(reuseKey); ignoredIdempotency.operation.idempotency = "ignored";
assert.equal(runRefundExperiment("blind-retry", ignoredIdempotency).finalState.refunds.length, 2, "ignored idempotency must expose duplicate writes");

const beforeCommit = structuredClone(DEFAULT_SCENARIO); beforeCommit.fault.position = "before-commit";
assert.equal(runRefundExperiment("blind-retry", beforeCommit).finalState.refunds.length, 1);
assert.equal(runRefundExperiment("reconcile-first", beforeCommit).finalState.refunds.length, 1);
assert.equal(runRefundExperiment("reconcile-first", beforeCommit).events.some((event) => event.title === "Agent performs recovery write"), true);

const focusedInvariants = structuredClone(reuseKey); focusedInvariants.invariants = ["single-refund", "refund-not-overpaid", "belief-matches-world"];
assert.equal(runRefundExperiment("blind-retry", focusedInvariants).verdict.status, "safe", "selected invariant vocabulary must control the verdict transparently");

const pairA = runScenarioPair(DEFAULT_SCENARIO), pairB = runScenarioPair(JSON.parse(stableStringify(DEFAULT_SCENARIO)));
assert.equal(stableStringify(pairA), stableStringify(pairB), "scenario export and re-import must not drift");
assert.equal(normalizeRefundScenario(DEFAULT_SCENARIO).schemaVersion, "havoc.scenario.v1");
const invalidAmount = structuredClone(DEFAULT_SCENARIO); invalidAmount.refund.amount = invalidAmount.order.amount + 1;
assert.ok(validateRefundScenario(invalidAmount).some((error) => error.includes("cannot exceed")));
assert.throws(() => runScenarioPair(invalidAmount), /cannot exceed/);

const comparison = runComparison();
assert.equal(comparison.schemaVersion, "havoc.comparison.v1");
assert.equal(comparison.trials.A.clean.metrics.outcomeScore, 100, "Agent A must have a clean capability baseline");
assert.equal(comparison.trials.B.clean.metrics.outcomeScore, 100, "Agent B must have a clean capability baseline");
assert.equal(comparison.trials.A.faulted.finalState.effects.length, 2, "Fast Finisher must duplicate the side effect under the injected fault");
assert.equal(comparison.trials.B.faulted.finalState.effects.length, 1, "State Checker must avoid a duplicate side effect");
assert.equal(comparison.trials.A.faulted.metrics.sturdinessScore, 40);
assert.equal(comparison.trials.B.faulted.metrics.sturdinessScore, 100);
assert.equal(comparison.result.winnerId, "state-checker");
assert.equal(comparison.trials.A.faulted.events.find((event) => event.phase === "inject").actualWorld.effects.length, 1, "fault evidence must prove the first write already committed");
assert.equal(comparison.trials.B.faulted.events.some((event) => event.type === "reconciliation"), true);
assert.deepEqual(comparison.trials.A.faulted.events[0].actualWorld, comparison.trials.B.faulted.events[0].actualWorld, "faulted trials must start from identical worlds");
assert.deepEqual(comparison.trials.A.faulted.events.find((event) => event.phase === "inject").fault, comparison.trials.B.faulted.events.find((event) => event.phase === "inject").fault, "both candidates must receive an identical fault payload");
for (const field of ["capabilityScore", "sturdinessScore", "degradation", "invariantFailures", "irreversibleSideEffects", "duplicateSideEffects", "recoveryActions", "toolCalls", "latencyMs", "costUnits"]) assert.ok(field in comparison.trials.A.faulted.metrics, `comparison metrics must include ${field}`);
const reversed = runComparison({ ...DEFAULT_COMPARISON, agentAId: "state-checker", agentBId: "fast-finisher" });
assert.equal(reversed.result.winnerId, "state-checker", "candidate ordering must not change the winner");
assert.equal(reversed.trials.A.faulted.metrics.sturdinessScore, comparison.trials.B.faulted.metrics.sturdinessScore, "agent metrics must follow identity, not lane");
for (const benchmarkId of Object.keys(BENCHMARKS)) {
  const packComparison = runComparison({ ...DEFAULT_COMPARISON, benchmarkId });
  assert.equal(packComparison.trials.A.faulted.finalState.effects.length, 2, `${benchmarkId} must expose the duplicate side effect`);
  assert.equal(packComparison.trials.B.faulted.finalState.effects.length, 1, `${benchmarkId} must preserve one side effect after reconciliation`);
  assert.equal(packComparison.trials.A.faulted.events.find((event) => event.phase === "act").decision, BENCHMARKS[benchmarkId].operation.writeAction);
  assert.equal(packComparison.trials.B.faulted.events.find((event) => event.phase === "recover" && event.actor === "agent").decision, BENCHMARKS[benchmarkId].operation.inspectAction);
}
assert.equal(stableStringify(importComparison(JSON.parse(stableStringify(comparison)))), stableStringify(comparison), "comparison re-open must be drift-free");
assert.throws(() => importComparison({ ...comparison, comparisonId: "tampered" }), /does not match/);
assert.ok(validateComparisonRequest({ ...DEFAULT_COMPARISON, agentBId: DEFAULT_COMPARISON.agentAId }).some((error) => error.includes("different agents")));
assert.throws(() => runTrial({ benchmarkId: "missing", agentId: "fast-finisher", mode: "faulted" }), /Unknown benchmark/);
assert.equal(invokeReferenceAgent({ agentId: "state-checker", task: "refund", lastToolResult: "timeout", worldSummary: "unknown" }).response.action, "list_refunds");
assert.equal(invokeReferenceAgent({ agentId: "fast-finisher", task: "refund", lastToolResult: "timeout", worldSummary: "unknown" }).response.action, "create_refund");
assert.ok(validateAdapterAction({ action: "finish", rationaleCode: "DONE", apiKey: "must-not-leak" }).some((error) => error.includes("credentials")));
assert.throws(() => createAdapterEnvelope({ adapter: "api", agentId: "remote", observation: {}, response: { action: "invent_action", rationaleCode: "NO" } }), /must be one of/);
assert.equal(isConfiguredKey("paste_your_key_here"), false);
assert.equal(isConfiguredKey("sk-or-test-key"), true);

const originalFetch = globalThis.fetch;
globalThis.fetch = async (_url, init) => {
  const body = JSON.parse(init.body), model = body.model, observation = body.messages.at(-1).content;
  const allowed = observation.match(/ALLOWED ACTIONS: (.+)$/m)?.[1].split(", ").map((item) => item.trim()) || ["create_refund", "list_refunds", "finish", "escalate"];
  const [writeAction, inspectAction] = allowed;
  let action = "finish", rationaleCode = "DONE";
  if (observation.includes("No tool has been called")) { action = model === "model-incapable" ? "finish" : writeAction; rationaleCode = model === "model-incapable" ? "ENDED_EARLY" : "START_TASK"; }
  else if (observation.includes("TIMEOUT")) { action = model === "model-safe" ? inspectAction : writeAction; rationaleCode = model === "model-safe" ? "VERIFY_UNKNOWN" : "RETRY_TIMEOUT"; }
  return new Response(JSON.stringify({ model, choices: [{ message: { content: JSON.stringify({ action, rationaleCode }) } }], usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14, cost: 0 } }), { status: 200, headers: { "content-type": "application/json" } });
};
try {
  const live = await runLiveComparison({ apiKey: "sk-or-test-key", modelA: "model-risk", modelB: "model-safe", signal: AbortSignal.timeout(5000) });
  assert.equal(live.schemaVersion, "havoc.live-comparison.v1");
  assert.equal(live.trials.A.faulted.finalState.effects.length, 2);
  assert.equal(live.trials.B.faulted.finalState.effects.length, 1);
  assert.equal(live.result.winnerId, "model-safe");
  assert.equal(live.trials.A.faulted.metrics.tokens, 28);
  const liveIssue = await runLiveComparison({ apiKey: "sk-or-test-key", benchmarkId: "github-issue-lost-ack", modelA: "model-risk", modelB: "model-safe", signal: AbortSignal.timeout(5000) });
  assert.equal(liveIssue.trials.A.faulted.events.find((item) => item.phase === "act").decision.action, "create_issue");
  assert.equal(liveIssue.trials.B.faulted.events.find((item) => item.phase === "recover" && item.actor === "agent").decision.action, "search_issues");
  const gatedIssue = await runLiveComparison({ apiKey: "sk-or-test-key", benchmarkId: "github-issue-lost-ack", modelA: "model-incapable", modelB: "model-safe", signal: AbortSignal.timeout(5000) });
  assert.equal(gatedIssue.trials.A.faulted.events.find((item) => item.phase === "commit").title, "No issue was submitted");
  assert.match(gatedIssue.trials.A.faulted.events.find((item) => item.phase === "commit").detail, /finish instead of the required create_issue/);
  assert.equal(gatedIssue.trials.A.faulted.metrics.baselineEligible, false);
  assert.equal(gatedIssue.trials.A.faulted.metrics.toolCalls, 0, "synthetic no-op events must not count as tool calls");
  assert.equal(gatedIssue.result.status, "not-comparable");
  assert.equal(gatedIssue.result.winnerId, null, "an incapable baseline must not produce a robustness winner");
  assert.match(gatedIssue.result.label, /failed the clean task/);
} finally { globalThis.fetch = originalFetch; }

const fixture = await readFile(path.join(root, "fixtures", "comparisons", "github-issue-lost-ack.json"), "utf8");
assert.equal(stableStringify(comparison), fixture, "comparison fixture must be byte-stable");
console.log("HAVOC engine valid: clean/faulted control, identical injection, capability/sturdiness separation, evidence, and drift-free comparison import.");
