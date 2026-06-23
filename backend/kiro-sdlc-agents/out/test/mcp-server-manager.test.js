"use strict";
/**
 * Unit tests for McpServerManager (HTTP Streamable transport)
 * Covers: spawn, kill, restart, invokeTool, handleCrash, timeout, backoff
 *
 * Strategy: We stub child_process.spawn and global fetch to test
 * McpServerManager behavior without real processes or HTTP servers.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const sinon = __importStar(require("sinon"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const events_1 = require("events");
const stream_1 = require("stream");
const mcp_server_manager_1 = require("../mcp-server-manager");
const types_1 = require("../types");
describe("McpServerManager", () => {
    let sandbox;
    let tmpDir;
    let outputChannel;
    beforeEach(() => {
        sandbox = sinon.createSandbox();
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-test-"));
        outputChannel = {
            appendLine: sandbox.stub(),
            append: sandbox.stub(),
            show: sandbox.stub(),
            dispose: sandbox.stub(),
        };
    });
    afterEach(() => {
        sandbox.restore();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });
    describe("getNonce()", () => {
        it("should return a 32-character hex string", () => {
            const nonce = (0, mcp_server_manager_1.getNonce)();
            assert.strictEqual(nonce.length, 32);
            assert.match(nonce, /^[0-9a-f]{32}$/);
        });
        it("should produce unique values across 1000 calls", () => {
            const nonces = new Set();
            for (let i = 0; i < 1000; i++) {
                nonces.add((0, mcp_server_manager_1.getNonce)());
            }
            assert.strictEqual(nonces.size, 1000);
        });
    });
    describe("spawn() — bundle missing", () => {
        it("should throw McpBundleMissingError when server bundle does not exist", async () => {
            const { McpServerManager } = require("../mcp-server-manager-legacy");
            const manager = new McpServerManager(path.join(tmpDir, "nonexistent-ext"), tmpDir, outputChannel);
            try {
                await manager.spawn();
                assert.fail("Should have thrown");
            }
            catch (err) {
                assert.strictEqual(err.name, "McpBundleMissingError");
            }
        });
    });
    describe("spawn() — bundle exists", () => {
        it("should spawn node with http-entry.js and transition to running on port announcement", async () => {
            const extDir = path.join(tmpDir, "ext");
            const serverDir = path.join(extDir, "mcp-server");
            fs.mkdirSync(serverDir, { recursive: true });
            fs.writeFileSync(path.join(serverDir, "http-entry.js"), "// fake server");
            fs.mkdirSync(path.join(tmpDir, ".code-intel"), { recursive: true });
            const cp = require("child_process");
            class MockProcess extends events_1.EventEmitter {
                pid = 12345;
                stdin = new stream_1.Writable({ write: (_c, _e, cb) => { cb(); } });
                stdout = new stream_1.Readable({ read() { } });
                stderr = new stream_1.Readable({ read() { } });
                kill() { return true; }
            }
            const mockProc = new MockProcess();
            const spawnStub = sandbox.stub(cp, "spawn").returns(mockProc);
            const { McpServerManager } = require("../mcp-server-manager-legacy");
            const manager = new McpServerManager(extDir, tmpDir, outputChannel);
            // Simulate port announcement via stderr
            setTimeout(() => mockProc.stderr.push("[mcp-http] Listening on port 54321\n"), 30);
            await manager.spawn();
            assert.ok(spawnStub.calledOnce);
            assert.strictEqual(spawnStub.firstCall.args[0], process.execPath);
            assert.ok(spawnStub.firstCall.args[1][0].includes("http-entry.js"));
            assert.strictEqual(manager.status, "running");
            assert.strictEqual(manager.pid, 12345);
            assert.strictEqual(manager.port, 54321);
        });
    });
    describe("kill()", () => {
        it("should do nothing if no server process exists", async () => {
            const { McpServerManager } = require("../mcp-server-manager-legacy");
            const manager = new McpServerManager(path.join(tmpDir, "nonexistent"), tmpDir, outputChannel);
            await manager.kill();
            assert.strictEqual(manager.status, "stopped");
        });
        it("should transition to stopped after killing a running server", async () => {
            const extDir = path.join(tmpDir, "ext");
            const serverDir = path.join(extDir, "mcp-server");
            fs.mkdirSync(serverDir, { recursive: true });
            fs.writeFileSync(path.join(serverDir, "http-entry.js"), "// fake");
            fs.mkdirSync(path.join(tmpDir, ".code-intel"), { recursive: true });
            const cp = require("child_process");
            class MockProcess extends events_1.EventEmitter {
                pid = 11111;
                stdin = new stream_1.Writable({ write: (_c, _e, cb) => { cb(); } });
                stdout = new stream_1.Readable({ read() { } });
                stderr = new stream_1.Readable({ read() { } });
                kill(_sig) {
                    setTimeout(() => this.emit("exit", 0, _sig), 5);
                    return true;
                }
            }
            const mockProc = new MockProcess();
            sandbox.stub(cp, "spawn").returns(mockProc);
            const { McpServerManager } = require("../mcp-server-manager-legacy");
            const manager = new McpServerManager(extDir, tmpDir, outputChannel);
            setTimeout(() => mockProc.stderr.push("[mcp-http] Listening on port 9999\n"), 20);
            await manager.spawn();
            assert.strictEqual(manager.status, "running");
            assert.strictEqual(manager.port, 9999);
            await manager.kill();
            assert.strictEqual(manager.status, "stopped");
            assert.strictEqual(manager.port, null);
        });
    });
    describe("invokeTool()", () => {
        it("should throw McpServerNotRunningError when status is stopped", async () => {
            const { McpServerManager } = require("../mcp-server-manager-legacy");
            const manager = new McpServerManager(path.join(tmpDir, "nonexistent"), tmpDir, outputChannel);
            try {
                await manager.invokeTool("test_tool", { query: "hello" });
                assert.fail("Should have thrown");
            }
            catch (err) {
                assert.strictEqual(err.name, "McpServerNotRunningError");
            }
        });
        it("should call fetch with correct URL and return text content", async () => {
            const extDir = path.join(tmpDir, "ext");
            const serverDir = path.join(extDir, "mcp-server");
            fs.mkdirSync(serverDir, { recursive: true });
            fs.writeFileSync(path.join(serverDir, "http-entry.js"), "// fake");
            fs.mkdirSync(path.join(tmpDir, ".code-intel"), { recursive: true });
            const cp = require("child_process");
            class MockProcess extends events_1.EventEmitter {
                pid = 22222;
                stdin = new stream_1.Writable({ write: (_c, _e, cb) => { cb(); } });
                stdout = new stream_1.Readable({ read() { } });
                stderr = new stream_1.Readable({ read() { } });
                kill() { return true; }
            }
            const mockProc = new MockProcess();
            sandbox.stub(cp, "spawn").returns(mockProc);
            // Stub global fetch
            const mockResponse = {
                ok: true,
                json: async () => ({
                    jsonrpc: "2.0",
                    id: 1,
                    result: { content: [{ type: "text", text: "search results" }] },
                }),
            };
            const fetchStub = sandbox.stub(global, "fetch").resolves(mockResponse);
            const { McpServerManager } = require("../mcp-server-manager-legacy");
            const manager = new McpServerManager(extDir, tmpDir, outputChannel);
            setTimeout(() => mockProc.stderr.push("[mcp-http] Listening on port 8080\n"), 20);
            await manager.spawn();
            const result = await manager.invokeTool("mem_search", { query: "x" });
            assert.strictEqual(result, "search results");
            // Verify fetch was called with correct URL
            assert.ok(fetchStub.calledOnce);
            const fetchUrl = fetchStub.firstCall.args[0];
            assert.strictEqual(fetchUrl, "http://127.0.0.1:8080/mcp");
            // Verify request body
            const fetchOpts = fetchStub.firstCall.args[1];
            const body = JSON.parse(fetchOpts.body);
            assert.strictEqual(body.method, "tools/call");
            assert.strictEqual(body.params.name, "mem_search");
            assert.deepStrictEqual(body.params.arguments, { query: "x" });
        });
    });
    describe("SERVER_CONSTANTS", () => {
        it("should have correct backoff values", () => {
            assert.deepStrictEqual([...types_1.SERVER_CONSTANTS.BACKOFF_MS], [5000, 15000, 30000]);
            assert.strictEqual(types_1.SERVER_CONSTANTS.MAX_RESTARTS, 3);
            assert.strictEqual(types_1.SERVER_CONSTANTS.REQUEST_TIMEOUT_MS, 30000);
            assert.strictEqual(types_1.SERVER_CONSTANTS.KILL_TIMEOUT_MS, 5000);
            assert.strictEqual(types_1.SERVER_CONSTANTS.STARTUP_TIMEOUT_MS, 5000);
        });
        it("should have correct graph and dashboard constants", () => {
            assert.strictEqual(types_1.SERVER_CONSTANTS.DASHBOARD_REFRESH_MS, 60000);
            assert.strictEqual(types_1.SERVER_CONSTANTS.GRAPH_MAX_NODES, 500);
        });
    });
    describe("onStatusChange event", () => {
        it("should fire starting then running during successful spawn", async () => {
            const extDir = path.join(tmpDir, "ext");
            const serverDir = path.join(extDir, "mcp-server");
            fs.mkdirSync(serverDir, { recursive: true });
            fs.writeFileSync(path.join(serverDir, "http-entry.js"), "// fake");
            fs.mkdirSync(path.join(tmpDir, ".code-intel"), { recursive: true });
            const cp = require("child_process");
            class MockProcess extends events_1.EventEmitter {
                pid = 33333;
                stdin = new stream_1.Writable({ write: (_c, _e, cb) => { cb(); } });
                stdout = new stream_1.Readable({ read() { } });
                stderr = new stream_1.Readable({ read() { } });
                kill() { return true; }
            }
            const mockProc = new MockProcess();
            sandbox.stub(cp, "spawn").returns(mockProc);
            const { McpServerManager } = require("../mcp-server-manager-legacy");
            const manager = new McpServerManager(extDir, tmpDir, outputChannel);
            const statuses = [];
            manager.onStatusChange((s) => statuses.push(s));
            setTimeout(() => mockProc.stderr.push("[mcp-http] Listening on port 7777\n"), 20);
            await manager.spawn();
            assert.ok(statuses.includes("starting"));
            assert.ok(statuses.includes("running"));
        });
    });
    describe("port property", () => {
        it("should return null when no process is running", () => {
            const { McpServerManager } = require("../mcp-server-manager-legacy");
            const manager = new McpServerManager(path.join(tmpDir, "nonexistent"), tmpDir, outputChannel);
            assert.strictEqual(manager.port, null);
        });
    });
    describe("pid property", () => {
        it("should return null when no process is running", () => {
            const { McpServerManager } = require("../mcp-server-manager-legacy");
            const manager = new McpServerManager(path.join(tmpDir, "nonexistent"), tmpDir, outputChannel);
            assert.strictEqual(manager.pid, null);
        });
    });
    describe("Error types", () => {
        it("McpServerNotRunningError should have correct name and message", () => {
            const err = new types_1.McpServerNotRunningError();
            assert.strictEqual(err.name, "McpServerNotRunningError");
            assert.strictEqual(err.message, "MCP Server is not running.");
        });
        it("McpBundleMissingError should have correct name and message", () => {
            const err = new types_1.McpBundleMissingError();
            assert.strictEqual(err.name, "McpBundleMissingError");
            assert.ok(err.message.includes("bundle not found"));
        });
    });
});
//# sourceMappingURL=mcp-server-manager.test.js.map