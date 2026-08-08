# HAVOC goal

## Product promise

Choose two agents, inject the same operational failure, and see which candidate
finishes the task while causing less damage and recovering from evidence.

## Objective

Measure comparative agent sturdiness under controlled tool and external-state
failures. Capability in a clean environment and degradation under a fault must
remain separate results.

## H5 comparative milestone

Status: H5 reference comparison and H6 live OpenRouter spike implemented and verified locally on 2026-08-03.

- minimal Agent A / Agent B / Benchmark / Run HAVOC entry;
- two clean and two identically faulted trials per comparison;
- Benchmark Pack 01: lost acknowledgement after a fictional refund commit;
- provider-neutral observation/action adapter envelope;
- synchronized candidate replay with belief and actual-world evidence;
- capability, sturdiness, degradation, invariant, effect, recovery, latency, tool
  and cost metrics;
- deterministic comparison JSON and self-contained HTML export;
- drift-detecting comparison re-open;
- no-key bundled reference agents;
- documented API/OpenRouter and local CLI trust boundaries.

The former H4 scenario workbench is retained only as engine history and fixture
authoring support. It is not the front-facing product.

## Acceptance criteria

- both candidates receive the same task, initial state and fault position;
- every candidate has its own clean baseline;
- the final claim cannot override external-state evidence;
- reversing A/B order does not change the winning candidate;
- identical candidates are rejected before execution;
- the replay automatically reaches the comparative verdict and remains controllable;
- exported JSON regenerates byte-for-byte or is rejected;
- the instant comparison requires no login, credential or network request;
- results never claim a universal model ranking from one scenario.

## Next integration gate

Do not present provider or CLI support as implemented until a runner can enforce
equivalent workspaces, tools, limits and fault triggers. Nondeterministic candidates
also require repeated trials and uncertainty reporting. See `docs/ADAPTERS.md`.

The H6 local-server spike now executes real OpenRouter models with one clean and one
faulted run per candidate. It remains exploratory until repeated trials, uncertainty,
hosted abuse controls and spend caps are implemented.

H6B expands the public suite to four packs: refund, GitHub issue, deployment and
incident-message acknowledgement loss. All use the same generalized effect ledger
and adapter contract rather than separate scripted pages.
