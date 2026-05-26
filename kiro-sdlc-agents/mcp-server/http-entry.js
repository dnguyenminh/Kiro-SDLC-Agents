#!/usr/bin/env node
"use strict";
/**
 * MCP Code Intelligence Server — Unified HTTP Entry Point.
 * Single port serves: MCP JSON-RPC (/mcp) + Viewer static files + Viewer API.
 * Child process (index.js) handles MCP logic via stdio. Viewer is disabled in child.
 */

const http = require("http");
const fs = require("fs");
const { spawn } = require("child_process");
const path = require("path");

const SERVER_PATH = path.join(__dirname, "index.js");
const VIEWER_DIR = path.join(__dirname, "viewer");
const READY_TIMEOUT_MS = 10000;
const CONTENT_TYPE_JSON = "application/json";
const MAX_BODY_SIZE = 4 * 1024 * 1024;

let childProcess = null;
let requestId = 0;
const pendingRequests = new Map();

// === Child Process (MCP stdio) ===

function spawnStdioServer() {
  const args = process.argv.slice(2);
  childProcess = spawn("node", [SERVER_PATH, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DISABLE_VIEWER: "1", CODE_INTEL_VIEWER_PORT: "0" },
    stdio: ["pipe", "pipe", "pipe"],
  });

  childProcess.stdout.on("data", handleChildStdout);
  childProcess.stderr.on("data", (chunk) => { process.stderr.write(chunk); });
  childProcess.on("exit", (code) => {
    console.error(`[mcp-http] Child exited (code: ${code})`);
    process.exit(code ?? 1);
  });
}

let stdoutBuffer = "";
function handleChildStdout(chunk) {
  stdoutBuffer += chunk.toString();
  let idx;
  while ((idx = stdoutBuffer.indexOf("\n")) !== -1) {
    const line = stdoutBuffer.substring(0, idx).trim();
    stdoutBuffer = stdoutBuffer.substring(idx + 1);
    if (!line) continue;
    try {
      const response = JSON.parse(line);
      if (response.id !== undefined) {
        const pending = pendingRequests.get(response.id);
        if (pending) {
          pendingRequests.delete(response.id);
          clearTimeout(pending.timeout);
          pending.resolve(response);
        }
      }
    } catch { /* non-JSON */ }
  }
}

function forwardToChild(jsonRpcRequest, timeoutMs) {
  return new Promise((resolve, reject) => {
    const id = jsonRpcRequest.id;
    const timeout = setTimeout(() => { pendingRequests.delete(id); reject(new Error("Request timeout")); }, timeoutMs);
    pendingRequests.set(id, { resolve, reject, timeout });
    childProcess.stdin.write(JSON.stringify(jsonRpcRequest) + "\n", (err) => {
      if (err) { clearTimeout(timeout); pendingRequests.delete(id); reject(err); }
    });
  });
}

// === MCP Handler ===

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on("data", (c) => { size += c.length; if (size > MAX_BODY_SIZE) { reject(new Error("Body too large")); req.destroy(); return; } chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

async function handleMcp(req, res) {
  if (req.method !== "POST") { res.writeHead(405, { Allow: "POST" }); res.end('{"error":"Method not allowed"}'); return; }
  let body;
  try { body = await readBody(req); } catch (e) { res.writeHead(400, { "Content-Type": CONTENT_TYPE_JSON }); res.end(JSON.stringify({ error: e.message })); return; }
  let jsonRpc;
  try { jsonRpc = JSON.parse(body); } catch { res.writeHead(400, { "Content-Type": CONTENT_TYPE_JSON }); res.end('{"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"Parse error"}}'); return; }
  if (jsonRpc.id === undefined) jsonRpc.id = ++requestId;
  try {
    const response = await forwardToChild(jsonRpc, 60000);
    res.writeHead(200, { "Content-Type": CONTENT_TYPE_JSON });
    res.end(JSON.stringify(response));
  } catch (err) {
    res.writeHead(504, { "Content-Type": CONTENT_TYPE_JSON });
    res.end(JSON.stringify({ jsonrpc: "2.0", id: jsonRpc.id, error: { code: -32000, message: err.message } }));
  }
}

// === Viewer: Static Files ===

const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };

function serveFile(relPath, res) {
  if (relPath.includes("..")) { send404(res); return; }
  const filePath = path.join(VIEWER_DIR, relPath);
  if (!fs.existsSync(filePath)) { send404(res); return; }
  const ext = path.extname(filePath);
  const ct = MIME[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": ct + "; charset=utf-8", "Cache-Control": "no-cache" });
  fs.createReadStream(filePath).pipe(res);
}

// === Viewer: API (forwarded as MCP tool calls) ===

function parseSearchResults(raw) {
  if (!raw) return [];
  try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed; } catch {}
  const entries = [];
  const lines = raw.split("\n");
  let current = null;
  for (const line of lines) {
    const typeMatch = line.match(/^\[(\w+)\]\s+(.+)/);
    if (typeMatch) { if (current) entries.push(current); current = { type: typeMatch[1], summary: typeMatch[2] }; }
    else if (current && line.match(/^\s+ID:\s*(\d+)/)) { const m = line.match(/ID:\s*(\d+)/); if (m) current.id = parseInt(m[1]); }
    else if (current && line.match(/^\s+Content:/)) { current.content = line.replace(/^\s+Content:\s*/, ""); }
  }
  if (current) entries.push(current);
  return entries;
}

async function handleViewerApi(url, res) {
  const apiPath = url.pathname.replace("/api/", "");
  try {
    if (apiPath === "memory/status" || apiPath === "kb/status") {
      try { sendJson(res, JSON.parse(await callTool("mem_admin", { action: "status" }))); }
      catch { sendJson(res, { totalEntries: 0, totalEdges: 0, totalVectors: 0, tierBreakdown: {} }); }
    } else if (apiPath === "memory/graph/data") {
      // Graph data: single call returns both nodes and edges
      const limit = parseInt(url.searchParams.get("limit") || "15000", 10);
      try {
        const raw = await callTool("mem_graph", { action: "graph_data", limit });
        const data = JSON.parse(raw);
        sendJson(res, { nodes: data.nodes || [], edges: data.edges || [], total_entries: (data.nodes || []).length, total_edges: (data.edges || []).length });
      } catch (err) {
        // Fallback: return empty graph
        sendJson(res, { nodes: [], edges: [], total_entries: 0, total_edges: 0, error: err.message });
      }
    } else if (apiPath === "kb/dashboard") {
      try { sendJson(res, JSON.parse(await callTool("mem_admin", { action: "dashboard" }))); }
      catch { sendJson(res, { total_entries: 0, total_edges: 0, tier_breakdown: {}, type_breakdown: {} }); }
    } else if (apiPath === "kb/quality") {
      try { sendJson(res, JSON.parse(await callTool("mem_scoring", { action: "quality_stats" }))); }
      catch { sendJson(res, { average_score: 0, total_scored: 0, distribution: {} }); }
    } else if (apiPath === "kb/quality/low") {
      const threshold = parseInt(url.searchParams.get("threshold") || "40", 10);
      const limit = parseInt(url.searchParams.get("limit") || "20", 10);
      try { sendJson(res, JSON.parse(await callTool("mem_scoring", { action: "low_quality", threshold, limit }))); }
      catch { sendJson(res, []); }
    } else if (apiPath === "kb/analytics") {
      try {
        const [trendsR, popR, gapsR] = await Promise.allSettled([
          callTool("mem_admin", { action: "trends", days: 30 }),
          callTool("mem_admin", { action: "popular", limit: 15 }),
          callTool("mem_admin", { action: "zero_results" })
        ]);
        const trends = trendsR.status === "fulfilled" ? JSON.parse(trendsR.value) : {};
        const popular = popR.status === "fulfilled" ? JSON.parse(popR.value) : [];
        const gaps = gapsR.status === "fulfilled" ? JSON.parse(gapsR.value) : [];
        const popArr = Array.isArray(popular) ? popular : (popular.queries || []);
        const gapsArr = Array.isArray(gaps) ? gaps : (gaps.queries || []);
        sendJson(res, { popular_queries: popArr, zero_results: gapsArr, search_trend: trends.search_volume || [] });
      } catch { sendJson(res, { popular_queries: [], zero_results: [], search_trend: [] }); }
    } else if (apiPath === "kb/citations/most") {
      const limit = parseInt(url.searchParams.get("limit") || "10", 10);
      try { sendJson(res, JSON.parse(await callTool("mem_citations", { action: "most_cited", limit }))); }
      catch { sendJson(res, []); }
    } else if (apiPath === "memory/entries") {
      const limit = parseInt(url.searchParams.get("limit") || "20", 10);
      try { sendJson(res, JSON.parse(await callTool("mem_crud", { action: "list", limit }))); }
      catch { sendJson(res, []); }
    } else if (apiPath === "memory/search") {
      const q = url.searchParams.get("q") || "";
      const raw = await callTool("mem_search", { query: q, limit: 20, detail: true });
      const entries = parseSearchResults(raw);
      sendJson(res, entries);
    } else if (apiPath === "kb/tags/search") {
      const tags = url.searchParams.get("tags") || url.searchParams.get("q") || "";
      const limit = parseInt(url.searchParams.get("limit") || "20", 10);
      const offset = parseInt(url.searchParams.get("offset") || "0", 10);
      try {
        const all = JSON.parse(await callTool("mem_tags", { action: "search", tags, limit: 500 }));
        const total = all.length;
        const page = all.slice(offset, offset + limit);
        sendJson(res, { entries: page, total, offset, limit });
      } catch { sendJson(res, { entries: [], total: 0, offset: 0, limit }); }
    } else if (apiPath === "kb/tags/popular") {
      const limit = parseInt(url.searchParams.get("limit") || "30", 10);
      try { sendJson(res, JSON.parse(await callTool("mem_tags", { action: "popular", limit }))); }
      catch { sendJson(res, []); }
    } else if (apiPath === "kb/tags") {
      try {
        const raw = JSON.parse(await callTool("mem_tags", { action: "taxonomy" }));
        if (Array.isArray(raw)) {
          const categories = {};
          for (const t of raw) { const cat = t.category || "uncategorized"; if (!categories[cat]) categories[cat] = []; categories[cat].push(t.tag); }
          sendJson(res, { categories });
        } else { sendJson(res, raw); }
      } catch { sendJson(res, { categories: {} }); }
    } else if (apiPath.startsWith("kb/suggestions")) {
      const q = url.searchParams.get("q") || "";
      const limit = parseInt(url.searchParams.get("limit") || "5", 10);
      try { sendJson(res, JSON.parse(await callTool("mem_discover", { action: "suggest", query: q, limit }))); }
      catch { sendJson(res, []); }
    } else {
      send404(res);
    }
  } catch (err) {
    if (!res.headersSent) { res.writeHead(500, { "Content-Type": CONTENT_TYPE_JSON }); res.end(JSON.stringify({ error: err.message })); }
  }
}

async function callTool(name, args) {
  const request = { jsonrpc: "2.0", id: ++requestId, method: "tools/call", params: { name, arguments: args } };
  const response = await forwardToChild(request, 30000);
  if (response.error) throw new Error(response.error.message);
  const text = response.result?.content?.[0]?.text ?? "{}";
  if (text.startsWith("Unknown tool:")) throw new Error(text);
  return text;
}

// === Router ===

function requestHandler(req, res) {
  const url = new URL(req.url, "http://localhost");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const p = url.pathname;

  // MCP endpoint
  if (p === "/mcp") { handleMcp(req, res).catch(() => { if (!res.headersSent) { res.writeHead(500); res.end(); } }); return; }
  // Health
  if (p === "/health") { res.writeHead(200, { "Content-Type": CONTENT_TYPE_JSON }); res.end('{"status":"ok"}'); return; }
  // Viewer API
  if (p.startsWith("/api/")) { handleViewerApi(url, res).catch(() => { if (!res.headersSent) { res.writeHead(500); res.end(); } }); return; }
  // Viewer pages
  if (p === "/" || p === "/index.html") { serveFile("index.html", res); return; }
  if (p === "/dashboard") { serveFile("dashboard.html", res); return; }
  if (p === "/tags") { serveFile("tags.html", res); return; }
  if (p === "/quality") { serveFile("quality.html", res); return; }
  if (p === "/analytics") { serveFile("analytics.html", res); return; }
  // Module/config subdirs
  if (p.startsWith("/modules/") || p.startsWith("/config/")) { serveFile(p.slice(1), res); return; }
  // Static files
  if (p.match(/\.(js|css|png|svg|json)$/)) { serveFile(path.basename(p), res); return; }

  send404(res);
}

function sendJson(res, data) { res.writeHead(200, { "Content-Type": CONTENT_TYPE_JSON }); res.end(JSON.stringify(data)); }
function send404(res) { res.writeHead(404, { "Content-Type": CONTENT_TYPE_JSON }); res.end('{"error":"Not found"}'); }

// === Main ===

async function main() {
  spawnStdioServer();
  const initRequest = {
    jsonrpc: "2.0", id: ++requestId, method: "initialize",
    params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "mcp-http-bridge", version: "2.0.0" }, roots: [{ uri: process.cwd() }] },
  };
  const initResponse = await forwardToChild(initRequest, READY_TIMEOUT_MS);
  if (initResponse.error) { console.error("[mcp-http] Initialize failed:", initResponse.error); process.exit(1); }

  const portArgIdx = process.argv.indexOf("--port");
  const requestedPort = portArgIdx !== -1 ? parseInt(process.argv[portArgIdx + 1], 10) : 0;
  const listenPort = (requestedPort > 0 && requestedPort < 65536) ? requestedPort : 0;

  const server = http.createServer(requestHandler);
  server.listen(listenPort, "127.0.0.1", () => { console.error(`[mcp-http] Listening on port ${server.address().port}`); });

  const shutdown = () => { server.close(); if (childProcess) childProcess.kill("SIGTERM"); process.exit(0); };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

process.on("uncaughtException", (err) => { console.error("[mcp-http] Uncaught:", err.message); });
process.on("unhandledRejection", (err) => { console.error("[mcp-http] Unhandled:", err); });
main().catch((err) => { console.error("[mcp-http] Fatal:", err.message); process.exit(1); });
