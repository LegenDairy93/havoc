import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchFreeModels, isConfiguredKey, runLiveComparison } from "../packages/runner/openrouter.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.HAVOC_PORT || 4174);
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };

function loadLocalEnv() {
  const file = path.join(root, ".env.local"); if (!existsSync(file)) return {};
  const values = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) { const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/); if (match) values[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, ""); }
  return values;
}

const localEnv = loadLocalEnv();
const openRouterKey = process.env.OPENROUTER_API_KEY || localEnv.OPENROUTER_API_KEY || "";
let activeMatch = false, modelCache = { at: 0, data: [] };
function json(response, status, payload) { response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); response.end(JSON.stringify(payload)); }
function safeError(error) { return String(error?.message || "Unknown runner error").replace(/sk-or-[A-Za-z0-9_-]+/g, "[REDACTED]").slice(0, 500); }
async function bodyJson(request) { const chunks = []; let size = 0; for await (const chunk of request) { size += chunk.length; if (size > 32_768) throw new Error("Request body exceeds 32 KB."); chunks.push(chunk); } return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }

async function api(request, response, pathname) {
  if (pathname === "/api/openrouter/status" && request.method === "GET") return json(response, 200, { configured: isConfiguredKey(openRouterKey), mode: "local-server" });
  if (!isConfiguredKey(openRouterKey)) return json(response, 503, { error: "OpenRouter is not configured in .env.local." });
  if (pathname === "/api/openrouter/models" && request.method === "GET") {
    try { if (Date.now() - modelCache.at > 300_000 || !modelCache.data.length) modelCache = { at: Date.now(), data: await fetchFreeModels(openRouterKey, { signal: AbortSignal.timeout(20_000) }) }; return json(response, 200, { models: modelCache.data }); }
    catch (error) { return json(response, 502, { error: safeError(error) }); }
  }
  if (pathname === "/api/openrouter/match" && request.method === "POST") {
    if (activeMatch) return json(response, 429, { error: "Another live match is already running locally." });
    activeMatch = true;
    try { const input = await bodyJson(request); const comparison = await runLiveComparison({ apiKey: openRouterKey, benchmarkId: input.benchmarkId, modelA: input.modelA, modelB: input.modelB, signal: AbortSignal.timeout(120_000) }); return json(response, 200, comparison); }
    catch (error) { return json(response, 502, { error: safeError(error) }); }
    finally { activeMatch = false; }
  }
  return json(response, 404, { error: "Unknown API route." });
}

createServer(async (request, response) => {
  const raw = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (raw.startsWith("/api/")) { await api(request, response, raw); return; }
  const requested = raw === "/" ? "/apps/replay/" : raw;
  const candidate = path.resolve(root, `.${requested}`);
  if (!candidate.startsWith(root) || !existsSync(candidate)) { response.writeHead(404).end("Not found"); return; }
  const file = statSync(candidate).isDirectory() ? path.join(candidate, "index.html") : candidate;
  response.writeHead(200, { "content-type": mime[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
  createReadStream(file).pipe(response);
}).listen(port, "127.0.0.1", () => console.log(`HAVOC arena: http://127.0.0.1:${port}/apps/replay/ · OpenRouter ${isConfiguredKey(openRouterKey) ? "configured" : "not configured"}`));
