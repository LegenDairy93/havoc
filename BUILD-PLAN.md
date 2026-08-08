# HAVOC build plan

Priority: 2 â€” second flagship experiment  
Build mode: deterministic simulator and static replay before model integrations

## Thirty-second experience

1. The visitor chooses `blind retry` or `reconcile before retry`.
2. A refund commits, but its acknowledgement is lost.
3. The screen splits into **agent belief** and **actual ledger state**.
4. Blind retry creates a duplicate refund; reconciliation avoids it.
5. Failed invariants explain the incident with event evidence.

## Launch headline

> I made an AI refund agent fail in the most expensive possible way.

## Technical slice

- Entirely fictional commerce world; no real payment integration.
- Model-free scripted policies first.
- Append-only event ledger and explicit tool commit points.
- Lost acknowledgement is the only initial injected fault.
- Artifact JSON drives a static replay; runtime and viewer remain separable.

## Milestones

### H0 â€” Cinematic incident storyboard

- Hand-author safe and unsafe event trajectories.
- Build a split-screen replay with a fault toggle.
- Show balances, agent belief, tool responses, and invariant state over time.

Exit: an unfamiliar viewer can explain why the duplicate happened in under 30
seconds without reading documentation.

### H1 â€” Deterministic world engine

- Define world-state, tool, event, fault, policy, and invariant schemas.
- Implement refund commit, lookup/reconciliation, and user-visible status.
- Implement blind-retry and reconcile-before-retry policies.
- Generate byte-stable normalized experiment bundles.

Exit: the same narrative shown in H0 is produced by the engine and covered by tests.

### H2 â€” Runner and evidence

- Add a one-command runner for the bundled scenario.
- Verify final state, duplicate effects, policy choices, and truthfulness of report.
- Export JSON and self-contained HTML.

Exit: a stranger reproduces both outcomes locally in under five minutes.

### H3 â€” Fault vocabulary

- Add duplicate delivery, partial success, and stale read one at a time.
- Require a new invariant or recovery distinction for every new fault.
- Document how this differs from a generic timeout/fault proxy.

Exit: each added fault reveals a different state-safety failure, not just another
error message.

## Current implementation status

- H0 is complete: the static replay exposes agent belief beside actual ledger state.
- H1 is complete for the lost-acknowledgement scenario: the engine generates both
  policies and evaluates explicit invariants deterministically.
- H2 is partially complete: one-command fixture generation, tests, and the static
  viewer exist. Self-contained HTML export remains future work.
- H3 has not started; no additional fault should be added before this first incident
  is reviewed end to end.

## Suggested structure

```text
packages/schema/          experiment and world schemas
packages/engine/          ledger, tools, policies, faults, invariants
packages/cli/             deterministic scenario runner
apps/replay/              static artifact viewer
scenarios/refund/         bundled world and policies
fixtures/                 golden evidence bundles
```

## Launch assets

- Split-screen duplicate-refund GIF.
- Safe/unsafe HTML replays.
- Small architecture diagram explaining commit versus acknowledgement.
- Table comparing HAVOC with generic network fault injection.

## Kill or reshape gate

Stop if the engine cannot prove a difference in external state when agent output is
identical, or if the result is adequately represented by an HTTP timeout proxy.

## H4 product-loop upgrade: scenario workbench

Status: implemented and verified locally on 2026-08-03.

### User loop

The user configures a bounded side-effect scenario, runs safe and unsafe recovery
policies, watches belief diverge from world state, changes one control, and exports a
reproducible experiment. This is a systems-safety workbench, not an LLM chat box.

### Supported inputs

- initial balance and requested refund amount;
- operation semantics: idempotent or non-idempotent;
- fault position relative to the external commit;
- retry count, reconciliation policy, and idempotency-key strategy;
- explicit invariants selected from the supported vocabulary;
- the bundled lost-acknowledgement refund preset.

Arbitrary user code, real payment credentials, and free-form model tools are not part
of H4.

### Staged build

1. **H4A - Editable refund lab:** schema-backed controls, immediate validation,
   deterministic rerun, reset, and URL-safe preset state where practical.
2. **H4B - Invariant workbench:** let users select and parameterize supported
   invariants; tie every verdict to ledger events and world snapshots.
3. **H4C - Import/export:** download scenario JSON, experiment JSON, and
   self-contained replay; re-open and reproduce the same event sequence.
4. **H4D - Trace adapter:** map a documented external trace into HAVOC's belief/world
   model only after the scenario loop is understood.

### Acceptance gates

- invalid amounts, impossible fault positions, and unsupported combinations are
  rejected before execution with a useful repair;
- changing idempotency or reconciliation visibly changes the ledger and verdict;
- the same normalized scenario generates the same ordered events and final state;
- the UI never performs a real external side effect;
- every failed invariant links to the events and state that falsified it;
- a stranger edits, runs, explains, exports, and re-opens a scenario in five minutes;
- unsafe results are presented as experiment outcomes, not security guarantees.

### Integration gate

Do not add hosted models merely to make the project look agentic. A model adapter is
justified only when the same world, faults, and invariants can compare a model policy
against the deterministic baselines without hiding decisions or requiring the public
demo to spend the maintainer's API credits.

### Implementation record

- replaced hard-coded experiment constants with a validated `havoc.scenario.v1`
  contract while preserving the original lost-acknowledgement preset;
- supports before/after commit faults, enforced/ignored idempotency, reused/rotated
  keys, one to three retries, amount/currency, and selected invariant controls;
- deterministically generates both policy runs, including deduplication and safe
  recovery-write evidence when the first request never committed;
- blocks invalid and impossible amounts before execution while preserving the last
  valid result;
- imports scenario/workbench JSON and exports deterministic scenario JSON, paired
  experiment JSON, a self-contained replay, and a URL-encoded preset;
- engine tests cover commit boundaries, idempotency semantics, retry strategy,
  selected invariants, validation, fixture stability, and export/re-import drift;
- live-browser verification covered material outcome changes, deduplication evidence,
  alternate fault position, invalid-input recovery, scenario import, export links,
  removal of page overflow, and a 390 px layout.

## H5 comparative robustness arena

Status: implemented and verified locally on 2026-08-03.

H5 replaces the front-facing H4 parameter workbench with the product-level loop:

```text
choose two agents -> clean baselines -> identical injected fault
-> synchronized evidence replay -> scenario-specific sturdiness result
```

### Implementation record

- added `havoc.benchmark.v1`, `havoc.trial.v1`, and `havoc.comparison.v1` contracts;
- executes Agent A/B in both clean and faulted modes under the same task, initial
  world and after-commit lost-acknowledgement trigger;
- separates clean capability, faulted outcome, degradation and sturdiness while also
  recording invariants, effects, recovery, tool use, latency and cost;
- added a provider-neutral observation/action envelope and deterministic reference
  adapter, plus explicit API and local CLI credential/runtime boundaries;
- reduced the public input to candidate A, candidate B, benchmark pack and one run
  action; scenario-author controls are not exposed;
- added automatic synchronized replay, external-state evidence, deterministic JSON
  and portable HTML export, and drift-detecting re-open;
- tests prove ordering independence, duplicate side-effect evidence, reconciliation,
  stable fixtures, invalid matchup rejection, credential exclusion and tamper
  rejection;
- live-browser verification covered the one-click run, automatic final verdict,
  reversed candidate ordering, invalid identical candidates, export links and a
  390 px layout without horizontal overflow.

## H6 live model spike

Status: implemented and verified locally on 2026-08-03.

- server-side `.env.local` loading without exposing the OpenRouter key;
- live discovery of specific free model ids, excluding the random router;
- model-driven normalized actions inside HAVOC's fictional ledger and fault proxy;
- one clean and one identically faulted trial for each selected model;
- clean-capability eligibility gate before a sturdiness score is awarded;
- live token, latency, cost, effect, invariant and recovery evidence;
- mocked automated runner coverage and a real browser match across two free models;
- live results explicitly labelled exploratory rather than leaderboard evidence.

## H6B benchmark suite

Status: implemented and verified locally on 2026-08-03.

- generalized the comparison world from refund-specific fields to declared resources
  and committed effects;
- added GitHub issue creation, production deployment and incident-message delivery;
- every pack declares a distinct task, write action, inspection action, commit event,
  fault trigger, evidence labels and portable deterministic fixture;
- reference and live OpenRouter adapters use the same pack action vocabulary;
- automated tests execute safe and unsafe paths across all four packs;
- browser verification covered all pack selectors and a real OpenRouter GitHub-issue
  run whose model independently reconciled with `search_issues`.
