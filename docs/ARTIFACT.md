# HAVOC comparison, trial, and legacy scenario artifacts

## Comparison v1

`havoc.comparison.v1` is the public artifact. It includes a normalized comparison
request, fixed benchmark pack, Agent A/B descriptors, clean and faulted trials for
both candidates, synchronized replay phases, and the derived scenario-specific
result. Re-import regenerates the complete comparison and rejects any byte-level
drift in request, events, metrics, checks, or result.

## Trial v1

`havoc.trial.v1` records one candidate in one mode (`clean` or `faulted`). Events
include an explicit phase, observable adapter decisions, agent belief, actual world,
tool calls and injected fault evidence. Metrics record completion, outcome score,
invariant failures, irreversible and duplicate effects, recovery actions, tool use,
latency and cost. Faulted trials add clean capability, degradation and sturdiness.

The legacy scenario, experiment, and workbench contracts below remain available for
fixture authors and compatibility; they are no longer the public entry point.

The generated JSON bundle is the source of truth for the replay. It contains no
model transcript and no hidden reasoning.

## Top-level fields

| Field | Meaning |
|---|---|
| `schemaVersion` | Artifact contract identifier (`havoc.experiment.v2`) |
| `experimentId` | Stable scenario and policy identity |
| `generatedAt` | Deterministic fixture timestamp |
| `scenario` | Fictional world and injected ambiguity |
| `policy` | Recovery policy under test |
| `initialState` | Order, refund ledger, and user-visible state before execution |
| `events` | Ordered evidence snapshots after every decision, commit, fault, and check |
| `finalState` | Actual external state at experiment completion |
| `finalAgentBelief` | State the scripted agent believes to be true |
| `finalMessage` | User-facing report, deliberately identical across both policies |
| `verdict` | Recovery classification and explicit invariant results |

## Event evidence

Every event records both `agentBelief` and `actualWorld`. Tool events may include a
`toolCall`; fault events include the injected `fault`; the final event embeds the
verdict. This duplication is deliberate: any replay step can be inspected without
reconstructing state from an implicit log.

## Safety boundary

The artifact proves what the deterministic fictional engine produced. It does not
prove correctness of a real payment provider, authorship, intent, or production
safety. A future real-agent adapter must preserve the distinction between captured
facts, policy decisions, and verifier derivations.

## Scenario v1

`havoc.scenario.v1` declares the fictional order/refund values, fault position,
provider idempotency semantics, retry count, retry-key strategy, and selected
invariant ids. It contains no execution result. Invalid or unsupported combinations
are rejected before a run.

## Workbench v1

`havoc.workbench.v1` packages one normalized scenario and the blind-retry and
reconcile-first experiment artifacts generated from it. Stable serialization allows
the bundle to be exported, imported, and regenerated without semantic drift.
