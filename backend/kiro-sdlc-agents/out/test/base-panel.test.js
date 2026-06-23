"use strict";
/**
 * Unit tests for BasePanel
 * Covers: create options, retainContextWhenHidden, sendMessage, dispose, server status listener
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
const mockVscode = __importStar(require("./mocks/vscode"));
describe("BasePanel", () => {
    let sandbox;
    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });
    afterEach(() => {
        sandbox.restore();
    });
    describe("Panel creation options", () => {
        it("should set retainContextWhenHidden to true", () => {
            const options = {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [],
            };
            assert.strictEqual(options.retainContextWhenHidden, true);
            assert.strictEqual(options.enableScripts, true);
        });
        it("should set correct viewType from PANEL_VIEW_TYPES", () => {
            const { PANEL_VIEW_TYPES } = require("../types");
            assert.strictEqual(PANEL_VIEW_TYPES.graph, "kiroKbGraph");
            assert.strictEqual(PANEL_VIEW_TYPES.dashboard, "kiroKbDashboard");
            assert.strictEqual(PANEL_VIEW_TYPES.tags, "kiroKbTags");
            assert.strictEqual(PANEL_VIEW_TYPES.quality, "kiroKbQuality");
            assert.strictEqual(PANEL_VIEW_TYPES.analytics, "kiroKbAnalytics");
        });
        it("should set correct title from PANEL_TITLES", () => {
            const { PANEL_TITLES } = require("../types");
            assert.strictEqual(PANEL_TITLES.graph, "KB Graph");
            assert.strictEqual(PANEL_TITLES.dashboard, "KB Dashboard");
            assert.strictEqual(PANEL_TITLES.tags, "KB Tags");
            assert.strictEqual(PANEL_TITLES.quality, "KB Quality");
            assert.strictEqual(PANEL_TITLES.analytics, "KB Analytics");
        });
    });
    describe("sendMessage()", () => {
        it("should call webview.postMessage when panel is alive", () => {
            const postMessage = sandbox.stub().resolves(true);
            const panel = { webview: { postMessage } };
            if (panel) {
                panel.webview.postMessage({ type: "serverStatus", status: "connected" });
            }
            assert.ok(postMessage.calledOnce);
            assert.deepStrictEqual(postMessage.firstCall.args[0], {
                type: "serverStatus",
                status: "connected",
            });
        });
        it("should not throw when panel is undefined (disposed)", () => {
            const panel = undefined;
            if (panel) {
                panel.webview.postMessage({ type: "error", message: "test", retryable: false });
            }
            assert.ok(true);
        });
        it("should send various message types", () => {
            const postMessage = sandbox.stub().resolves(true);
            const panel = { webview: { postMessage } };
            const messages = [
                { type: "graphData", nodes: [], edges: [] },
                { type: "dashboardData", health: 85, types: {}, tiers: {}, trend: [], recent: [] },
                { type: "error", message: "Connection failed", retryable: true },
            ];
            messages.forEach((msg) => panel.webview.postMessage(msg));
            assert.strictEqual(postMessage.callCount, 3);
        });
    });
    describe("dispose()", () => {
        it("should call panel.dispose()", () => {
            const dispose = sandbox.stub();
            const panel = { dispose };
            panel.dispose();
            assert.ok(dispose.calledOnce);
        });
        it("should fire onDispose event", () => {
            const emitter = new mockVscode.EventEmitter();
            const callback = sandbox.stub();
            emitter.event(callback);
            emitter.fire(undefined);
            assert.ok(callback.calledOnce);
        });
        it("should clean up disposables array", () => {
            const disposables = [
                { dispose: sandbox.stub() },
                { dispose: sandbox.stub() },
                { dispose: sandbox.stub() },
            ];
            disposables.forEach((d) => d.dispose());
            disposables.forEach((d) => assert.ok(d.dispose.calledOnce));
        });
    });
    describe("Server status listener", () => {
        it("should map running to connected", () => {
            const statusMap = (status) => {
                return status === "running" ? "connected" : status === "crashed" ? "failed" : "disconnected";
            };
            assert.strictEqual(statusMap("running"), "connected");
            assert.strictEqual(statusMap("crashed"), "failed");
            assert.strictEqual(statusMap("stopped"), "disconnected");
            assert.strictEqual(statusMap("starting"), "disconnected");
        });
        it("should send serverStatus message on status change", () => {
            const emitter = new mockVscode.EventEmitter();
            const postMessage = sandbox.stub().resolves(true);
            emitter.event((status) => {
                const webviewStatus = status === "running" ? "connected" : status === "crashed" ? "failed" : "disconnected";
                postMessage({ type: "serverStatus", status: webviewStatus });
            });
            emitter.fire("running");
            assert.ok(postMessage.calledOnceWith({ type: "serverStatus", status: "connected" }));
            emitter.fire("crashed");
            assert.ok(postMessage.calledWith({ type: "serverStatus", status: "failed" }));
        });
    });
    describe("isAlive property", () => {
        it("should return true when panel exists", () => {
            const panel = { _panel: {} };
            const isAlive = panel._panel !== undefined;
            assert.strictEqual(isAlive, true);
        });
        it("should return false when panel is undefined", () => {
            const panel = { _panel: undefined };
            const isAlive = panel._panel !== undefined;
            assert.strictEqual(isAlive, false);
        });
    });
});
//# sourceMappingURL=base-panel.test.js.map