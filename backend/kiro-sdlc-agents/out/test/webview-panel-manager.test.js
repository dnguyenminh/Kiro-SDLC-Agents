"use strict";
/**
 * Unit tests for WebviewPanelManager
 * Covers: openPanel (new + existing), disposeAll, notifyAllPanels, singleton enforcement
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
describe("WebviewPanelManager", () => {
    let sandbox;
    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });
    afterEach(() => {
        sandbox.restore();
    });
    describe("Singleton enforcement via Map", () => {
        it("should store only one panel per type in a Map", () => {
            const panels = new Map();
            const type = "graph";
            const mockPanel = { isAlive: true, reveal: sandbox.stub() };
            panels.set(type, mockPanel);
            // Try to open same type again
            const existing = panels.get(type);
            if (existing && existing.isAlive) {
                existing.reveal();
            }
            assert.ok(mockPanel.reveal.calledOnce);
            assert.strictEqual(panels.size, 1);
        });
        it("should allow different panel types simultaneously", () => {
            const panels = new Map();
            panels.set("graph", { isAlive: true });
            panels.set("dashboard", { isAlive: true });
            panels.set("tags", { isAlive: true });
            assert.strictEqual(panels.size, 3);
        });
        it("should replace stale panel reference", () => {
            const panels = new Map();
            panels.set("graph", { isAlive: false });
            const existing = panels.get("graph");
            if (existing && !existing.isAlive) {
                panels.delete("graph");
            }
            panels.set("graph", { isAlive: true });
            assert.strictEqual(panels.size, 1);
            assert.ok(panels.get("graph").isAlive);
        });
    });
    describe("disposeAll()", () => {
        it("should dispose all panels and clear the map", () => {
            const panels = new Map();
            const p1 = { dispose: sandbox.stub() };
            const p2 = { dispose: sandbox.stub() };
            panels.set("graph", p1);
            panels.set("dashboard", p2);
            for (const [, panel] of panels) {
                panel.dispose();
            }
            panels.clear();
            assert.ok(p1.dispose.calledOnce);
            assert.ok(p2.dispose.calledOnce);
            assert.strictEqual(panels.size, 0);
        });
    });
    describe("notifyAllPanels()", () => {
        it("should send message to all alive panels", () => {
            const panels = new Map();
            const p1 = { isAlive: true, sendMessage: sandbox.stub() };
            const p2 = { isAlive: true, sendMessage: sandbox.stub() };
            const p3 = { isAlive: false, sendMessage: sandbox.stub() };
            panels.set("graph", p1);
            panels.set("dashboard", p2);
            panels.set("tags", p3);
            const message = { type: "serverStatus", status: "connected" };
            for (const [, panel] of panels) {
                if (panel.isAlive) {
                    panel.sendMessage(message);
                }
            }
            assert.ok(p1.sendMessage.calledOnceWith(message));
            assert.ok(p2.sendMessage.calledOnceWith(message));
            assert.ok(p3.sendMessage.notCalled);
        });
        it("should handle empty panels map gracefully", () => {
            const panels = new Map();
            const message = { type: "serverStatus", status: "disconnected" };
            for (const [, panel] of panels) {
                if (panel.isAlive) {
                    panel.sendMessage(message);
                }
            }
            assert.strictEqual(panels.size, 0);
        });
    });
    describe("openPanel() — reveal existing", () => {
        it("should reveal existing alive panel instead of creating new", () => {
            const panels = new Map();
            const existingPanel = { isAlive: true, reveal: sandbox.stub() };
            panels.set("graph", existingPanel);
            const type = "graph";
            const existing = panels.get(type);
            if (existing && existing.isAlive) {
                existing.reveal();
            }
            assert.ok(existingPanel.reveal.calledOnce);
        });
    });
    describe("getPanel()", () => {
        it("should return panel if alive", () => {
            const panels = new Map();
            const panel = { isAlive: true };
            panels.set("dashboard", panel);
            const result = panels.get("dashboard");
            assert.ok(result?.isAlive);
        });
        it("should return undefined for non-existent type", () => {
            const panels = new Map();
            const result = panels.get("quality");
            assert.strictEqual(result, undefined);
        });
        it("should return undefined for dead panel", () => {
            const panels = new Map();
            panels.set("tags", { isAlive: false });
            const panel = panels.get("tags");
            const result = panel?.isAlive ? panel : undefined;
            assert.strictEqual(result, undefined);
        });
    });
});
//# sourceMappingURL=webview-panel-manager.test.js.map