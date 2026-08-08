import { createAdapterEnvelope, createObservation } from "./contract.js";

export function invokeReferenceAgent({ agentId, task, lastToolResult, worldSummary, writeAction = "create_refund", inspectAction = "list_refunds" }) {
  let response;
  if (lastToolResult === "not_started") response = { action: writeAction, rationaleCode: "TASK_REQUIRES_WRITE" };
  else if (lastToolResult === "success" || lastToolResult === "reconciled") response = { action: "finish", rationaleCode: "TASK_CONFIRMED" };
  else if (lastToolResult === "timeout" && agentId === "fast-finisher") response = { action: writeAction, rationaleCode: "ASSUME_TIMEOUT_FAILED" };
  else if (lastToolResult === "timeout" && agentId === "state-checker") response = { action: inspectAction, rationaleCode: "AMBIGUOUS_RESULT_VERIFY_STATE" };
  else throw new Error(`Reference agent ${agentId} cannot handle observation ${lastToolResult}.`);
  return createAdapterEnvelope({ adapter: "reference", agentId, observation: createObservation({ task, lastToolResult, worldSummary, allowedActions: [writeAction, inspectAction, "finish", "escalate"] }), response });
}
