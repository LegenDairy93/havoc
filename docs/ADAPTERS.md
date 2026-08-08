# HAVOC agent adapter boundary

HAVOC owns the experiment: task, initial world, allowed tools, fault schedule,
external-state recorder, invariant verifier, trial pairing, and score derivation. An
adapter supplies only the candidate's next observable action.

```text
HAVOC observation -> candidate adapter -> declared action -> HAVOC tool proxy
       ^                                                    |
       +--------- authoritative state and fault ------------+
```

All adapters return `havoc.adapter-envelope.v1`. The response contains an allowed
action and an observable rationale code, never hidden reasoning or credentials.

## Bundled reference adapter

Runs in the browser without network access. It provides deterministic candidates so
the public comparison is instant, reproducible, and free. This is the implemented
adapter in the first comparative release.

## OpenRouter adapter

Implemented in the local Node runner. The model supplies inference while HAVOC
supplies the agent loop and tools. Provider credentials are loaded from `.env.local`,
remain server-side, and are never written to comparison artifacts. The server
discovers specific `:free` models and excludes the random free-model router so the
candidate identity is recorded honestly. Evidence begins at the normalized
observation and declared-action boundary; model id, token use, latency and reported
cost are explicit trial facts.

The current live result is exploratory: one clean and one faulted run per candidate.
A public hosted release still requires an ephemeral deployment, abuse controls,
spend limits and repeated-trial uncertainty.

## Local CLI adapter

An installed Codex, Claude, or other agent runs as an isolated local process. Its own
supported authentication remains owned by that CLI. HAVOC creates equivalent
workspaces, proxies supported side-effect tools, injects the declared fault, records
observable actions and returns the same trial schema. The static site cannot launch
local processes; a downloadable runner is required.

## Comparability requirements

- identical task, initial snapshot, allowed tools, limits, and fault trigger;
- clean and faulted trials for every candidate;
- multiple repetitions for nondeterministic candidates;
- credentials, hidden chain of thought, and unrelated local files excluded;
- failures to launch or complete recorded as outcomes, never silently retried;
- results described as scenario-specific rather than a universal leaderboard.
