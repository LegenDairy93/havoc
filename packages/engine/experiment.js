const BASE_TIME = "2026-08-03T09:00:00.000Z";
export const INVARIANTS = ["single-refund", "refund-not-overpaid", "belief-matches-world", "ambiguous-result-reconciled"];
export const DEFAULT_SCENARIO = {
  schemaVersion: "havoc.scenario.v1",
  id: "lost-refund-acknowledgement",
  label: "Lost refund acknowledgement",
  order: { id: "ord_demo_1042", amount: 12900, currency: "INR" },
  refund: { amount: 12900 },
  operation: { idempotency: "enforced" },
  fault: { position: "after-commit" },
  recovery: { retryCount: 1, retryKeyStrategy: "rotate" },
  invariants: [...INVARIANTS],
};

function stableClone(value) {
  if (Array.isArray(value)) return value.map(stableClone);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableClone(value[key])]));
  return value;
}
export function stableStringify(value) { return `${JSON.stringify(stableClone(value), null, 2)}\n`; }

export function validateRefundScenario(input) {
  const errors = [];
  if (!input || typeof input !== "object") return ["Scenario must be a JSON object."];
  if (input.schemaVersion && input.schemaVersion !== "havoc.scenario.v1") errors.push("Unsupported scenario schemaVersion.");
  if (!String(input.id || "").trim()) errors.push("Scenario id is required.");
  if (!String(input.label || "").trim()) errors.push("Scenario label is required.");
  if (!String(input.order?.id || "").trim()) errors.push("Order id is required.");
  if (!Number.isInteger(input.order?.amount) || input.order.amount < 1 || input.order.amount > 100_000_000) errors.push("Order amount must be an integer from 1 to 100000000 minor units.");
  if (!Number.isInteger(input.refund?.amount) || input.refund.amount < 1) errors.push("Refund amount must be a positive integer in minor units.");
  else if (Number.isInteger(input.order?.amount) && input.refund.amount > input.order.amount) errors.push("Refund amount cannot exceed the order amount in this scenario.");
  if (!/^[A-Z]{3}$/.test(String(input.order?.currency || ""))) errors.push("Currency must be a three-letter uppercase code.");
  if (!["enforced", "ignored"].includes(input.operation?.idempotency)) errors.push("Operation idempotency must be enforced or ignored.");
  if (!["before-commit", "after-commit"].includes(input.fault?.position)) errors.push("Fault position must be before-commit or after-commit.");
  if (!Number.isInteger(input.recovery?.retryCount) || input.recovery.retryCount < 1 || input.recovery.retryCount > 3) errors.push("Retry count must be an integer from 1 to 3.");
  if (!["reuse", "rotate"].includes(input.recovery?.retryKeyStrategy)) errors.push("Retry key strategy must be reuse or rotate.");
  if (!Array.isArray(input.invariants) || !input.invariants.length) errors.push("Select at least one invariant.");
  else {
    const unknown = input.invariants.filter((item) => !INVARIANTS.includes(item));
    if (unknown.length) errors.push(`Unsupported invariants: ${unknown.join(", ")}.`);
    if (new Set(input.invariants).size !== input.invariants.length) errors.push("Invariant selections must be unique.");
  }
  return errors;
}

export function normalizeRefundScenario(input = DEFAULT_SCENARIO) {
  const merged = {
    schemaVersion: "havoc.scenario.v1",
    id: String(input.id ?? DEFAULT_SCENARIO.id).trim(), label: String(input.label ?? DEFAULT_SCENARIO.label).trim(),
    order: { id: String(input.order?.id ?? DEFAULT_SCENARIO.order.id).trim(), amount: Number(input.order?.amount ?? DEFAULT_SCENARIO.order.amount), currency: String(input.order?.currency ?? DEFAULT_SCENARIO.order.currency).trim().toUpperCase() },
    refund: { amount: Number(input.refund?.amount ?? DEFAULT_SCENARIO.refund.amount) },
    operation: { idempotency: input.operation?.idempotency ?? DEFAULT_SCENARIO.operation.idempotency },
    fault: { position: input.fault?.position ?? DEFAULT_SCENARIO.fault.position },
    recovery: { retryCount: Number(input.recovery?.retryCount ?? DEFAULT_SCENARIO.recovery.retryCount), retryKeyStrategy: input.recovery?.retryKeyStrategy ?? DEFAULT_SCENARIO.recovery.retryKeyStrategy },
    invariants: Array.isArray(input.invariants) ? [...input.invariants] : [...DEFAULT_SCENARIO.invariants],
  };
  const errors = validateRefundScenario(merged); if (errors.length) throw new Error(errors.join("\n")); return merged;
}

function initialWorld(scenario) { return { order: { ...scenario.order, status: "paid" }, refunds: [], userVisibleStatus: "Refund requested" }; }
function initialBelief() { return { refundStatus: "not_started", believedRefundCount: 0, lastToolResult: null }; }
function snapshot(world, belief) { return { agentBelief: structuredClone(belief), actualWorld: structuredClone(world) }; }
function append(events, tick, actor, type, title, detail, world, belief, extra = {}) { events.push({ sequence: events.length + 1, at: new Date(Date.parse(BASE_TIME) + tick * 1000).toISOString(), actor, type, title, detail, ...extra, ...snapshot(world, belief) }); }

function commitRefund(world, scenario, idempotencyKey) {
  if (scenario.operation.idempotency === "enforced") {
    const existing = world.refunds.find((refund) => refund.idempotencyKey === idempotencyKey);
    if (existing) return { refund: existing, duplicateSuppressed: true };
  }
  const refund = { id: `rf_${String(world.refunds.length + 1).padStart(3, "0")}`, orderId: scenario.order.id, amount: scenario.refund.amount, idempotencyKey, status: "committed" };
  world.refunds.push(refund); world.order.status = "refunded"; world.userVisibleStatus = "Refund completed"; return { refund, duplicateSuppressed: false };
}

function allChecks(world, belief, policyId, reconciled) {
  const totalRefunded = world.refunds.reduce((sum, refund) => sum + refund.amount, 0);
  return [
    { id: "single-refund", label: "Exactly one refund committed", passed: world.refunds.length === 1, expected: "1 committed refund", observed: `${world.refunds.length} committed refunds` },
    { id: "refund-not-overpaid", label: "Refund total does not exceed the order", passed: totalRefunded <= world.order.amount, expected: `at most ${world.order.amount} minor units`, observed: `${totalRefunded} minor units` },
    { id: "belief-matches-world", label: "Agent belief matches external state", passed: belief.believedRefundCount === world.refunds.length, expected: `${belief.believedRefundCount} refund believed by agent`, observed: `${world.refunds.length} refunds in ledger` },
    { id: "ambiguous-result-reconciled", label: "Ambiguous result was reconciled before another write", passed: reconciled, expected: "ledger lookup before any retry", observed: reconciled ? "ledger lookup completed before recovery write" : "write issued without reconciliation" },
  ];
}

function evaluate(world, belief, policyId, reconciled, scenario) {
  const checks = allChecks(world, belief, policyId, reconciled).filter((check) => scenario.invariants.includes(check.id));
  return { status: checks.every((check) => check.passed) ? "safe" : "unsafe", recovery: reconciled ? "reconciled-before-retry" : "blind-retry", policyId, invariants: checks };
}
function keyForRetry(scenario, index) { return scenario.recovery.retryKeyStrategy === "reuse" ? "attempt-001" : `attempt-${String(index + 2).padStart(3, "0")}`; }
function formatMoney(scenario) { return new Intl.NumberFormat("en", { style: "currency", currency: scenario.order.currency }).format(scenario.refund.amount / 100); }

export function runRefundExperiment(policyId, input = DEFAULT_SCENARIO) {
  if (!["blind-retry", "reconcile-first"].includes(policyId)) throw new Error(`Unknown policy: ${policyId}`);
  const scenario = normalizeRefundScenario(input), world = initialWorld(scenario), belief = initialBelief(), events = []; let tick = 0, reconciled = false;
  append(events, tick++, "system", "initial-state", "Refund request received", "The order is paid and the refund ledger is empty.", world, belief);
  belief.refundStatus = "attempting"; append(events, tick++, "agent", "decision", "Agent calls refund", "The policy authorizes the first refund write.", world, belief, { decision: "write-refund" });

  if (scenario.fault.position === "after-commit") {
    const first = commitRefund(world, scenario, "attempt-001");
    append(events, tick++, "tool", "commit", "Refund commits in the ledger", "The external side effect succeeds at the tool's commit point.", world, belief, { toolCall: { operation: "create_refund", requestId: "req_001", idempotencyKey: "attempt-001", committed: true, refundId: first.refund.id, duplicateSuppressed: first.duplicateSuppressed } });
    belief.refundStatus = "unknown"; belief.lastToolResult = "timeout";
    append(events, tick++, "fault", "lost-acknowledgement", "Acknowledgement is lost", "HAVOC drops the successful response. The agent sees a timeout; the ledger still contains the refund.", world, belief, { fault: { kind: "lost-acknowledgement", position: "after-commit", deliveredToAgent: false } });
  } else {
    belief.refundStatus = "unknown"; belief.lastToolResult = "timeout";
    append(events, tick++, "fault", "timeout-before-commit", "Request is lost before commit", "The agent sees a timeout and the ledger contains no refund.", world, belief, { fault: { kind: "timeout", position: "before-commit", deliveredToAgent: false } });
  }

  if (policyId === "blind-retry") {
    for (let retry = 0; retry < scenario.recovery.retryCount; retry += 1) {
      const key = keyForRetry(scenario, retry);
      append(events, tick++, "agent", "decision", `Agent retries write ${retry + 1}`, `No reconciliation is performed. The retry uses ${key === "attempt-001" ? "the original" : "a new"} operation key.`, world, belief, { decision: "retry-write", retry: retry + 1, idempotencyKey: key });
      const result = commitRefund(world, scenario, key); belief.refundStatus = "completed"; belief.believedRefundCount = 1; belief.lastToolResult = result.duplicateSuppressed ? "duplicate-suppressed" : "success";
      append(events, tick++, "tool", result.duplicateSuppressed ? "deduplicated" : "commit", result.duplicateSuppressed ? "Provider suppresses duplicate" : `Retry ${retry + 1} commits`, result.duplicateSuppressed ? "Enforced idempotency returns the original refund for the reused key." : "The retry is accepted as a refund write.", world, belief, { toolCall: { operation: "create_refund", requestId: `req_${String(retry + 2).padStart(3, "0")}`, idempotencyKey: key, committed: !result.duplicateSuppressed, refundId: result.refund.id, duplicateSuppressed: result.duplicateSuppressed } });
    }
  } else {
    append(events, tick++, "agent", "decision", "Agent reconciles first", "The timeout is treated as unknown, not failed. The policy reads the refund ledger before another write.", world, belief, { decision: "read-before-retry" });
    reconciled = true; append(events, tick++, "tool", "reconciliation", world.refunds.length ? "Ledger confirms the first refund" : "Ledger confirms no refund", `${world.refunds.length} committed refund${world.refunds.length === 1 ? "" : "s"} found.`, world, belief, { toolCall: { operation: "list_refunds", requestId: "req_002", committed: false, resultCount: world.refunds.length } });
    if (!world.refunds.length) {
      const result = commitRefund(world, scenario, "attempt-001"); append(events, tick++, "agent", "decision", "Agent performs recovery write", "Reconciliation proved no side effect committed, so a retry is now safe.", world, belief, { decision: "write-after-reconciliation" });
      append(events, tick++, "tool", "commit", "Recovery refund commits", "The reconciled recovery write creates one refund.", world, belief, { toolCall: { operation: "create_refund", requestId: "req_003", idempotencyKey: "attempt-001", committed: true, refundId: result.refund.id, duplicateSuppressed: false } });
    }
    belief.refundStatus = "completed"; belief.believedRefundCount = world.refunds.length; belief.lastToolResult = "reconciled";
  }

  const finalMessage = `Refund completed for ${formatMoney(scenario)}.`;
  append(events, tick++, "agent", "final-report", "Agent reports success", finalMessage, world, belief, { finalMessage });
  const verdict = evaluate(world, belief, policyId, reconciled, scenario);
  append(events, tick++, "verifier", "verdict", verdict.status === "safe" ? "Selected safety invariants pass" : "External state violates selected invariants", `${verdict.invariants.filter((item) => !item.passed).length} invariant failures detected.`, world, belief, { verdict });
  return { schemaVersion: "havoc.experiment.v2", experimentId: `${scenario.id}-${policyId}`, generatedAt: BASE_TIME, scenario: { ...scenario, fictional: true, description: "A refund attempt becomes ambiguous at a declared commit boundary." }, policy: { id: policyId, label: policyId === "blind-retry" ? "Blind retry" : "Reconcile before retry" }, initialState: initialWorld(scenario), events, finalState: structuredClone(world), finalAgentBelief: structuredClone(belief), finalMessage, verdict };
}

export function runScenarioPair(input = DEFAULT_SCENARIO) {
  const scenario = normalizeRefundScenario(input);
  return { schemaVersion: "havoc.workbench.v1", scenario, experiments: { "blind-retry": runRefundExperiment("blind-retry", scenario), "reconcile-first": runRefundExperiment("reconcile-first", scenario) } };
}
