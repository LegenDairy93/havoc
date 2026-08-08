# HAVOC

**A fault-injection prototype for testing how tool-using agents behave under partial
failure.**

> Status: experimental. Complete and working, but not maintained as a product and not
> accepting a roadmap. See [Scope](#scope) before investing time in it.

## The question it explores

Your agent calls a tool that commits — a deploy, an issue, an incident post. The write
lands. Then the response is lost on the way back, so the agent never learns it
worked.

The API has idempotency protection, and it works correctly. The agent retries with a
freshly generated key. The provider sees a new request, because that is exactly what
it received, and the action happens twice.

Every component behaved as designed. The trace looks clean.

HAVOC injects that fault deliberately and checks what happened to external state
afterward, rather than trusting what the agent reported.

```text
what the agent believes happened
        versus
what actually happened to external state
```

## The interesting finding

Idempotency is not a property of the infrastructure. It is a property of **correct
client behavior**. The platform provides the mechanism; the caller still has to use
it — reuse the key across retries, pin the same target, check state before writing.
Kubernetes converges *if you re-apply the same manifest*. A GitHub integration avoids
duplicates *if it reconciles authoritative state before creating another issue*.

LLM agents are structurally weak here. A retry is a fresh generation. Nothing makes
key reuse salient — no compiler enforces it, no type error fires, and "generate a
unique request id" looks like the more correct instinct. So the agent rotates the
key, walks through a deduplication layer that is working perfectly, and produces a
duplicate write with a clean-looking trace.

`fixtures/blind-retry.json` is exactly this: idempotency `enforced`, one agent
retrying with `attempt-001` and being correctly deduplicated, the other rotating to
`attempt-002` and committing twice.

## Try it — 30 seconds, no API key

No runtime dependencies, no network calls, no credentials.

```bash
npm run build && npm run dev
```

Open `http://127.0.0.1:4174/apps/replay/`, pick two agents and a benchmark pack, and
press **Run HAVOC**. It runs four controlled trials and replays the faulted pair side
by side — agent belief on one side, actual world state on the other.

## How it works

Each candidate runs the same task twice: once clean, once with an identical fault
injected at a declared tool boundary.

```text
Agent A clean     Agent A faulted
Agent B clean     Agent B faulted
        \           /
  external-state verifier -> comparative robustness result
```

Two runs per candidate, because a single faulted run cannot distinguish an agent that
degraded badly from one that was never capable. Clean capability and fault
degradation stay separate numbers.

The verifier reads external state, never the agent's own report. A candidate claiming
success cannot override the ledger.

### Benchmark packs

| Pack | Workflow | Injected ambiguity | Duplicate effect |
|---|---|---|---|
| 01 | GitHub issue creation | Response lost after issue created | Duplicate issue filed |
| 02 | Production deployment | Control-plane response lost after start | Release deployed twice |
| 03 | Incident notification | Delivery ack lost after post | On-call paged twice |

Each pack declares its own write action, reconciliation action, authoritative
resource, and invariant evidence, running through the same effect ledger and adapter
contract.

### Output

Deterministic JSON (`havoc.comparison.v1`) and self-contained HTML. Re-opening an
artifact regenerates the comparison and rejects tampering or drift. Examples are in
`fixtures/comparisons/`.

### Adapters

The engine owns the task, world, tools, fault schedule, and verifier. An adapter
supplies only the candidate's next observable action.

- **Reference adapter** — deterministic browser-local candidates, no setup.
- **OpenRouter adapter** — runs real models. Add `OPENROUTER_API_KEY` to `.env.local`
  and choose **Live OpenRouter**. Credentials stay server-side.
- **Local CLI adapter** — specified, not implemented.

See [docs/ADAPTERS.md](docs/ADAPTERS.md).

## Scope

This is a prototype that answers a research question, not a tool to adopt. Being
direct about why:

- **It compares candidates rather than testing yours.** The useful product shape
  would be a single-agent pass/fail check wired into CI. That is not built, and
  ranking two models against one synthetic scenario is not a decision anyone makes.
- **The world is simulated.** Packs are deterministic fictional environments. No real
  service is contacted. Results prove the comparison mechanism, not the safety of any
  deployment.
- **Live mode is exploratory.** One clean and one faulted trial per candidate cannot
  support a confident claim about a nondeterministic model. Repeated trials and
  uncertainty reporting are not implemented.
- **Scores do not transfer.** Scenario-specific by construction; this is not a model
  leaderboard.
- **Agent platforms are absorbing this.** Tracing and checkpointing are increasingly
  built in, which narrows the case for a standalone tool.

The fault-injection runner is the reusable part. It may later become a testing
feature inside a larger tool rather than a product of its own.

## Design notes

[docs/COMPETITORS.md](docs/COMPETITORS.md) · [docs/ARTIFACT.md](docs/ARTIFACT.md) ·
[BUILD-PLAN.md](BUILD-PLAN.md)
