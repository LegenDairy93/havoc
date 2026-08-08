export const ACTIONS = Object.freeze(["create_refund", "list_refunds", "create_issue", "search_issues", "start_deployment", "list_deployments", "send_message", "search_messages", "finish", "escalate"]);

export const ADAPTER_TARGETS = Object.freeze({
  reference: {
    kind: "reference",
    runtime: "browser",
    inference: "deterministic",
    credentialBoundary: "none",
    description: "Bundled, reproducible agents used by the instant public benchmark.",
  },
  api: {
    kind: "api",
    runtime: "ephemeral-runner",
    inference: "provider-model",
    credentialBoundary: "runner-memory-only",
    description: "OpenRouter or direct model APIs provide inference; HAVOC retains the loop, tools, fault schedule and verifier.",
  },
  cli: {
    kind: "cli",
    runtime: "local-isolated-process",
    inference: "external-agent",
    credentialBoundary: "owned-by-installed-cli",
    description: "Codex, Claude or another installed agent runs locally; HAVOC proxies observable effects and never exports authentication state.",
  },
});

export function validateAdapterAction(input) {
  const errors = [];
  if (!input || typeof input !== "object") return ["Adapter response must be an object."];
  if (!ACTIONS.includes(input.action)) errors.push(`Adapter action must be one of: ${ACTIONS.join(", ")}.`);
  if (!String(input.rationaleCode || "").trim()) errors.push("Adapter response requires an observable rationaleCode.");
  if ("credentials" in input || "apiKey" in input || "token" in input) errors.push("Adapter responses must never contain credentials.");
  return errors;
}

export function createObservation({ task, lastToolResult, worldSummary, allowedActions = ACTIONS }) {
  return { schemaVersion: "havoc.observation.v1", task, lastToolResult, worldSummary, allowedActions: [...allowedActions] };
}

export function createAdapterEnvelope({ adapter, agentId, observation, response }) {
  const errors = validateAdapterAction(response); if (errors.length) throw new Error(errors.join("\n"));
  if (!ADAPTER_TARGETS[adapter]) throw new Error(`Unknown adapter kind: ${adapter}`);
  return { schemaVersion: "havoc.adapter-envelope.v1", adapter: ADAPTER_TARGETS[adapter], agentId, observation, response };
}
