# HAVOC competitive landscape

Reviewed: 2026-08-03

## Direct and adjacent projects

### Faultkit

[Faultkit](https://faultkit.dev/) describes itself as fault injection for the agent
era. It wraps commands, injects failures at the SDK/API boundary, and exercises LLM,
RAG, and tool-call failures.

Consequence: HAVOC cannot claim novelty from wrapping an agent command or injecting
API failures.

### FlakeStorm

[FlakeStorm](https://github.com/flakestorm/flakestorm) applies chaos-engineering
ideas to agent robustness, including environmental faults, behavioral contracts,
replay, and adversarial inputs.

Consequence: “chaos testing for agents with replay” is not a sufficient thesis.

### agent-chaos

[agent-chaos](https://github.com/deepankarm/agent-chaos) is an open-source project
explicitly using the agent-chaos label and targeting agent framework integrations.

Consequence: framework adapters and the category name are not differentiators.

### AgentRx

[Microsoft AgentRx](https://github.com/microsoft/AgentRx) diagnoses failures from
execution trajectories by synthesizing invariants, checking steps, and localizing a
critical failure.

Consequence: trajectory diagnosis and invariant checking alone are occupied.

### PromptDiff

[PromptDiff](https://github.com/LegenDairy93/promptdiff) compares and governs
behavioral changes between runs.

Boundary: PromptDiff compares recorded behavior; HAVOC creates stateful ambiguity
experiments and verifies external side-effect correctness.

## Defensible wedge

HAVOC should own **agent belief versus external state under ambiguous side effects**.
The technical center is a world-state ledger, action semantics, reconciliation, and
postcondition evidence—not the fault toggle itself.

## Open research questions

- Do the direct competitors already model committed-but-unacknowledged actions as a
  first-class state rather than a generic timeout?
- Can HAVOC express compensation and reconciliation without becoming domain-specific?
- Can tool authors declare idempotency and postconditions with a small schema?
- Is a tool-call adapter sufficient, or is a proxy required for credible testing?

