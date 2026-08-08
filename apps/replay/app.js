import { AGENTS, BENCHMARKS, DEFAULT_COMPARISON, importComparison, runComparison, validateComparisonRequest } from "../../packages/engine/benchmark.js";
import { stableStringify } from "../../packages/engine/experiment.js";

const $ = (selector) => document.querySelector(selector);
const state = { comparison: null, phaseIndex: 0, playing: false, urls: [], mode: "reference", liveModels: [], liveConfigured: false };
const phaseLabels = { start: "WORLD", act: "FIRST ACTION", commit: "COMMIT", inject: "FAULT", recover: "RECOVERY", report: "FINAL CLAIM", verify: "VERDICT" };

function option(value, label) { const item = document.createElement("option"); item.value = value; item.textContent = label; return item; }
function fillReferenceAgents() {
  $("#agent-a").replaceChildren(); $("#agent-b").replaceChildren();
  for (const agent of Object.values(AGENTS)) { $("#agent-a").append(option(agent.id, agent.label)); $("#agent-b").append(option(agent.id, agent.label)); }
  $("#agent-a").value = DEFAULT_COMPARISON.agentAId; $("#agent-b").value = DEFAULT_COMPARISON.agentBId;
}
function fillLiveAgents() {
  $("#agent-a").replaceChildren(); $("#agent-b").replaceChildren();
  for (const model of state.liveModels) { $("#agent-a").append(option(model.id, model.name)); $("#agent-b").append(option(model.id, model.name)); }
  if (state.liveModels.length > 1) $("#agent-b").selectedIndex = 1;
}
function fillSelectors() {
  fillReferenceAgents();
  for (const pack of Object.values(BENCHMARKS)) $("#benchmark").append(option(pack.id, `PACK ${pack.number} · ${pack.shortLabel}`));
  $("#benchmark").value = DEFAULT_COMPARISON.benchmarkId;
  renderSelection();
}

function renderSelection() {
  const agentA = state.mode === "reference" ? AGENTS[$("#agent-a").value] : state.liveModels.find((item) => item.id === $("#agent-a").value), agentB = state.mode === "reference" ? AGENTS[$("#agent-b").value] : state.liveModels.find((item) => item.id === $("#agent-b").value), pack = BENCHMARKS[$("#benchmark").value];
  $("#agent-a-description").textContent = state.mode === "reference" ? agentA?.description ?? "" : agentA ? `${agentA.id} · live free model` : ""; $("#agent-b-description").textContent = state.mode === "reference" ? agentB?.description ?? "" : agentB ? `${agentB.id} · live free model` : "";
  $("#benchmark-task").textContent = pack?.task ?? ""; $("#benchmark-fault").textContent = pack ? `INJECTION: ${pack.faultLabel}` : "";
}

function requestFromUI() { return state.mode === "reference" ? { schemaVersion: "havoc.comparison-request.v1", benchmarkId: $("#benchmark").value, agentAId: $("#agent-a").value, agentBId: $("#agent-b").value } : { benchmarkId: $("#benchmark").value, modelA: $("#agent-a").value, modelB: $("#agent-b").value }; }
function status(kind, label, detail) { const root = $("#run-status"); root.className = `run-status ${kind}`; root.querySelector("b").textContent = label; root.querySelector("span").textContent = detail; }
function cleanUrls() { state.urls.forEach((url) => URL.revokeObjectURL(url)); state.urls = []; }
function blobUrl(content, type) { const url = URL.createObjectURL(new Blob([content], { type })); state.urls.push(url); return url; }
function safeJson(value) { return stableStringify(value).replaceAll("<", "\\u003c"); }

function portableReplay(comparison) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>HAVOC comparison</title><style>:root{color-scheme:dark}*{box-sizing:border-box}body{max-width:1080px;margin:0 auto;padding:28px;background:#08090d;color:#f5f2eb;font-family:system-ui}small{color:#a887ff}h1{font-size:clamp(34px,6vw,64px);letter-spacing:-.05em}.scores,.lanes{display:grid;grid-template-columns:1fr 1fr;gap:10px}.card{padding:18px;border:1px solid #2a2f3b;background:#10131a}.metric{font:700 30px monospace}.muted,p{color:#9ba1ae}input{width:100%;margin:18px 0;accent-color:#a887ff}@media(max-width:650px){.scores,.lanes{grid-template-columns:1fr}}</style><small>HAVOC / PORTABLE COMPARISON</small><h1 id="winner"></h1><p id="basis"></p><div class="scores" id="scores"></div><input id="step" type="range" min="0" value="0"><h2 id="phase"></h2><div class="lanes" id="lanes"></div><script>const DATA=${safeJson(comparison)};const q=s=>document.querySelector(s),phases=DATA.replayPhases;function esc(s){return String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}function eventAt(side,phase){const events=DATA.trials[side].faulted.events.filter(e=>e.phase===phase);return events[events.length-1]}function draw(){const phase=phases[+q('#step').value];q('#phase').textContent=(+q('#step').value+1)+' / '+phases.length+' · '+phase.toUpperCase();q('#lanes').innerHTML=['A','B'].map(side=>{const e=eventAt(side,phase),m=DATA.trials[side].faulted.metrics,belief=e.agentBelief.believedEffectCount??e.agentBelief.believedRefundCount??0,effects=e.actualWorld.effects??e.actualWorld.refunds??[];return '<article class="card"><small>AGENT '+side+'</small><h2>'+esc(DATA.agents[side].label)+'</h2><h3>'+esc(e.title)+'</h3><p>'+esc(e.detail)+'</p><p class="muted">Belief: '+belief+' · Actual effects: '+effects.length+'</p><b>Sturdiness '+m.sturdinessScore+'</b></article>'}).join('')}q('#winner').textContent=DATA.result.label;q('#basis').textContent=DATA.result.basis;q('#step').max=phases.length-1;q('#scores').innerHTML=['A','B'].map(side=>{const m=DATA.trials[side].faulted.metrics;return '<div class="card"><small>'+esc(DATA.agents[side].label)+'</small><div class="metric">'+m.capabilityScore+' capability / '+m.sturdinessScore+' sturdy</div></div>'}).join('');q('#step').oninput=draw;draw();<\/script></html>`;
}

function eventAt(side, phase) { const events = state.comparison.trials[side].faulted.events.filter((event) => event.phase === phase); return events.at(-1); }
function beliefText(event) { const count = event.agentBelief.believedEffectCount ?? event.agentBelief.believedRefundCount ?? 0; return `${count} believed effect${count === 1 ? "" : "s"} · ${(event.agentBelief.lastToolResult ?? "waiting").replaceAll("-", " ")}`; }
function worldText(event) { const effects = event.actualWorld.effects ?? event.actualWorld.refunds ?? []; return `${effects.length} committed effect${effects.length === 1 ? "" : "s"}`; }

function renderLane(side, event) {
  $("#kind-" + side.toLowerCase()).textContent = `${event.actor.toUpperCase()} · ${event.type.replaceAll("-", " ").toUpperCase()}`;
  $("#event-" + side.toLowerCase()).textContent = event.title; $("#detail-" + side.toLowerCase()).textContent = event.detail;
  $("#belief-" + side.toLowerCase()).textContent = beliefText(event); $("#world-" + side.toLowerCase()).textContent = worldText(event);
}

function renderReplay() {
  const phases = state.comparison.replayPhases, phase = phases[state.phaseIndex], eventA = eventAt("A", phase), eventB = eventAt("B", phase);
  $("#phase-title").textContent = eventA.title === eventB.title ? eventA.title : `${eventA.title} / ${eventB.title}`;
  $("#phase-count").textContent = `${String(state.phaseIndex + 1).padStart(2, "0")} / ${String(phases.length).padStart(2, "0")}`;
  renderLane("A", eventA); renderLane("B", eventB);
  $("#fault-marker").classList.toggle("active", ["inject", "recover", "report", "verify"].includes(phase));
  $("#previous").disabled = state.playing || state.phaseIndex === 0; $("#next").disabled = state.playing || state.phaseIndex === phases.length - 1; $("#play").textContent = state.playing ? "PLAYING…" : "▶ PLAY";
  document.querySelectorAll(".phase-rail button").forEach((button, index) => button.classList.toggle("active", index === state.phaseIndex));
}

function renderEvidence() {
  const grid = $("#evidence-grid"); grid.replaceChildren();
  for (const side of ["A", "B"]) for (const check of state.comparison.trials[side].faulted.checks) {
    const item = document.createElement("div"); item.className = `evidence-item ${check.passed ? "pass" : "fail"}`;
    const title = document.createElement("b"), detail = document.createElement("span"); title.textContent = `${check.passed ? "PASS" : "FAIL"} · ${state.comparison.agents[side].label} · ${check.label}`; detail.textContent = check.observed; item.append(title, detail); grid.append(item);
  }
}

function prepareExports() { cleanUrls(); $("#export-json").href = blobUrl(stableStringify(state.comparison), "application/json"); $("#export-html").href = blobUrl(portableReplay(state.comparison), "text/html"); }
function renderComparison() {
  const c = state.comparison; $("#results").hidden = false; $("#result-title").textContent = c.result.label; $("#result-basis").textContent = c.result.basis; $("#fault-label").textContent = c.benchmark.faultLabel;
  for (const side of ["A", "B"]) {
    const lower = side.toLowerCase(), metrics = c.trials[side].faulted.metrics, agent = c.agents[side];
    $("#name-" + lower).textContent = agent.label; $("#lane-name-" + lower).textContent = agent.label;
    $("#capability-" + lower).textContent = metrics.capabilityScore; $("#sturdiness-" + lower).textContent = metrics.baselineEligible === false ? "N/E" : metrics.sturdinessScore; $("#degradation-" + lower).textContent = `−${metrics.degradation}`;
    const cost = c.schemaVersion === "havoc.live-comparison.v1" ? `$${Number(metrics.costUnits).toFixed(6)}` : `${metrics.costUnits} cost units`;
    $("#summary-" + lower).textContent = `${metrics.irreversibleSideEffects} irreversible effect${metrics.irreversibleSideEffects === 1 ? "" : "s"} · ${metrics.invariantFailures} invariant failure${metrics.invariantFailures === 1 ? "" : "s"} · ${metrics.toolCalls} tool calls · ${metrics.latencyMs} ms latency · ${metrics.tokens ?? 0} tokens · ${cost}`;
    $("#score-" + lower).classList.toggle("winner", c.result.winnerId === agent.id);
  }
  const rail = $("#phase-rail"); rail.replaceChildren(); c.replayPhases.forEach((phase, index) => { const button = document.createElement("button"); button.textContent = phaseLabels[phase]; button.addEventListener("click", () => { state.playing = false; state.phaseIndex = index; renderReplay(); }); rail.append(button); });
  state.phaseIndex = 0; renderReplay(); renderEvidence(); prepareExports();
}

async function play() {
  if (state.playing) return; state.playing = true; state.phaseIndex = 0; renderReplay();
  while (state.playing && state.phaseIndex < state.comparison.replayPhases.length - 1) { await new Promise((resolve) => setTimeout(resolve, 850)); if (!state.playing) return; state.phaseIndex += 1; renderReplay(); }
  state.playing = false; renderReplay();
}

async function execute(request, { autoPlay = true } = {}) {
  state.playing = false;
  const errors = state.mode === "reference" ? validateComparisonRequest(request) : (!request.modelA || !request.modelB ? ["Choose two live models."] : request.modelA === request.modelB ? ["Choose two different live models."] : []); if (errors.length) { status("error", "MATCH BLOCKED", errors[0]); return false; }
  const button = $("#run-havoc"); button.disabled = true; button.classList.add("running"); button.innerHTML = "<span>●</span> INJECTING FAULT"; status("", "RUNNING", "Establishing clean baselines before applying the controlled fault…");
  await new Promise((resolve) => setTimeout(resolve, 450));
  try {
    if (state.mode === "reference") state.comparison = runComparison(request);
    else { const response = await fetch("/api/openrouter/match", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || "Live match failed."); state.comparison = payload; }
    renderComparison(); status("", state.mode === "reference" ? "COMPARISON COMPLETE" : "LIVE MATCH COMPLETE", state.mode === "reference" ? "Four controlled trials generated locally. No network calls were made." : "Four model-driven trials completed. This is an exploratory single-run result."); $("#results").scrollIntoView({ behavior: "smooth", block: "start" }); if (autoPlay) setTimeout(play, 500); return true;
  }
  catch (error) { status("error", "RUN FAILED", error.message.split("\n")[0]); return false; }
  finally { button.disabled = false; button.classList.remove("running"); button.innerHTML = `<span>▶</span> ${state.mode === "live" ? "RUN LIVE HAVOC" : "RUN HAVOC"}`; }
}

function openComparisonArtifact(input) {
  if (input?.schemaVersion === "havoc.live-comparison.v1") {
    if (!input.agents?.A || !input.agents?.B || !input.trials?.A?.clean || !input.trials?.A?.faulted || !input.trials?.B?.clean || !input.trials?.B?.faulted || !Array.isArray(input.replayPhases) || !input.result) throw new Error("Live comparison artifact is incomplete.");
    return input;
  }
  return importComparison(input);
}

async function loadLiveModels() {
  const liveButton = document.querySelector('[data-mode="live"]');
  try {
    const statusResponse = await fetch("/api/openrouter/status"), server = await statusResponse.json(); state.liveConfigured = Boolean(server.configured);
    if (!state.liveConfigured) { liveButton.disabled = true; liveButton.title = "Add OPENROUTER_API_KEY to .env.local and restart HAVOC."; return; }
    const modelsResponse = await fetch("/api/openrouter/models"), payload = await modelsResponse.json(); if (!modelsResponse.ok) throw new Error(payload.error || "Could not load free models."); state.liveModels = payload.models || [];
    liveButton.disabled = state.liveModels.length < 2; liveButton.title = liveButton.disabled ? "Fewer than two free models are currently available." : `${state.liveModels.length} free models available`;
  } catch (error) { liveButton.disabled = true; liveButton.title = error.message; }
}

function setMode(mode) {
  if (mode === "live" && (!state.liveConfigured || state.liveModels.length < 2)) { status("error", "LIVE MODE UNAVAILABLE", document.querySelector('[data-mode="live"]').title || "OpenRouter models are unavailable."); return; }
  state.playing = false; state.mode = mode; document.querySelectorAll(".mode-switch button").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
  if (mode === "reference") { fillReferenceAgents(); status("", "READY", "No API key. No real payment. The reference result is generated locally."); }
  else { fillLiveAgents(); status("", "LIVE MODE READY", `${state.liveModels.length} free models discovered. One clean and one faulted run will be executed per candidate.`); }
  $("#runner-scope").innerHTML = `<span></span> ${mode === "live" ? "LIVE API · FICTIONAL WORLD · EXPLORATORY" : "NO KEY · FICTIONAL WORLD · DETERMINISTIC"}`;
  $("#run-havoc").innerHTML = `<span>▶</span> ${mode === "live" ? "RUN LIVE HAVOC" : "RUN HAVOC"}`; renderSelection();
}

for (const id of ["#agent-a", "#agent-b", "#benchmark"]) $(id).addEventListener("change", renderSelection);
document.querySelectorAll(".mode-switch button").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
$("#run-havoc").addEventListener("click", () => execute(requestFromUI())); $("#replay-all").addEventListener("click", play); $("#play").addEventListener("click", play);
$("#previous").addEventListener("click", () => { state.phaseIndex = Math.max(0, state.phaseIndex - 1); renderReplay(); }); $("#next").addEventListener("click", () => { state.phaseIndex = Math.min(state.comparison.replayPhases.length - 1, state.phaseIndex + 1); renderReplay(); });
$("#import-button").addEventListener("click", () => $("#import-file").click());
$("#import-file").addEventListener("change", async (event) => { const file = event.target.files[0]; if (!file) return; try { state.playing = false; state.comparison = openComparisonArtifact(JSON.parse(await file.text())); renderComparison(); status("", "COMPARISON OPENED", state.comparison.schemaVersion === "havoc.live-comparison.v1" ? "Captured live evidence opened locally." : "The request and evidence regenerated without drift."); $("#results").scrollIntoView({ behavior: "smooth", block: "start" }); } catch (error) { status("error", "OPEN BLOCKED", error.message.split("\n")[0]); } finally { event.target.value = ""; } });
document.addEventListener("keydown", (event) => { if (!state.comparison || state.playing || !["ArrowLeft", "ArrowRight"].includes(event.key) || ["SELECT", "INPUT"].includes(event.target.tagName)) return; state.phaseIndex = Math.max(0, Math.min(state.comparison.replayPhases.length - 1, state.phaseIndex + (event.key === "ArrowRight" ? 1 : -1))); renderReplay(); });
fillSelectors(); loadLiveModels();
