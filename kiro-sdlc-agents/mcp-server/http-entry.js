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

async function handleViewerApi(url, res) {
  const apiPath = url.pathname.replace("/api/", "");
  try {
    if (apiPath === "memory/status" || apiPath === "kb/status") {
      sendJson(res, JSON.parse(await callTool("mem_admin", { action: "status" })));
    } else if (apiPath === "memory/graph/data") {
      // Graph data: get edges from graph, build nodes
      const limit = parseInt(url.searchParams.get("limit") || "1000", 10);
      const raw = await callTool("mem_admin", { action: "dashboard" });
      const dash = JSON.parse(raw);
      // Get all edges
      const edgesRaw = await callTool("mem_graph", { action: "ego", node_id: 1, radius: 100 });
      // Fallback: return stats only
      sendJson(res, { nodes: [], edges: [], total_entries: dash.total_entries || 0, total_edges: dash.total_edges || 0 });
    } else if (apiPath === "kb/dashboard") {
      sendJson(res, JSON.parse(await callTool("mem_admin", { action: "dashboard" })));
    } else if (apiPath === "kb/quality") {
      sendJson(res, JSON.parse(await callTool("mem_scoring", { action: "quality_stats" })));
    } else if (apiPath === "kb/quality/low") {
      const threshold = parseInt(url.searchParams.get("threshold") || "40", 10);
      const limit = parseInt(url.searchParams.get("limit") || "20", 10);
      sendJson(res, JSON.parse(await callTool("mem_scoring", { action: "low_quality", threshold, limit })));
    } else if (apiPath === "kb/analytics") {
      sendJson(res, JSON.parse(await callTool("mem_admin", { action: "trends", days: 30 })));
    } else if (apiPath === "kb/citations/most") {
      const limit = parseInt(url.searchParams.get("limit") || "10", 10);
      sendJson(res, JSON.parse(await callTool("mem_citations", { action: "most_cited", limit })));
    } else if (apiPath === "memory/entries") {
      const limit = parseInt(url.searchParams.get("limit") || "20", 10);
      sendJson(res, JSON.parse(await callTool("mem_crud", { action: "list", limit })));
    } else if (apiPath === "memory/search") {
      const q = url.searchParams.get("q") || "";
      sendJson(res, JSON.parse(await callTool("mem_search", { query: q, limit: 20 })));
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
  return response.result?.content?.[0]?.text ?? "{}";
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
