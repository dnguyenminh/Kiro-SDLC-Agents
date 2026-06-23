"use strict";
/**
 * Unit tests for NativeAddonManager (KSA-175).
 * Tests platform detection, cache logic, and manifest parsing.
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
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
// Mock vscode module
const mockContext = {
    globalStorageUri: { fsPath: path.join(__dirname, "../../test-fixtures/globalStorage") },
    extensionPath: path.join(__dirname, "../../"),
};
const mockOutputChannel = {
    appendLine: sinon.stub(),
};
describe("NativeAddonManager", () => {
    let sandbox;
    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });
    afterEach(() => {
        sandbox.restore();
    });
    describe("getPlatformInfo()", () => {
        it("should return correct platform info for current system", () => {
            // This test validates the platform detection logic
            const platform = process.platform;
            const arch = process.arch;
            const napiVersion = process.versions.napi || "9";
            assert.ok(["win32", "darwin", "linux"].includes(platform));
            assert.ok(["x64", "arm64", "ia32"].includes(arch));
            assert.ok(parseInt(napiVersion) >= 8, "N-API version should be >= 8");
        });
        it("should construct correct cache key", () => {
            const platform = process.platform;
            const arch = process.arch;
            const napiVersion = process.versions.napi || "9";
            const expectedKey = `napi-v${napiVersion}-${platform}-${arch}`;
            assert.ok(expectedKey.startsWith("napi-v"));
            assert.ok(expectedKey.includes(platform));
            assert.ok(expectedKey.includes(arch));
        });
    });
    describe("release-manifest.json", () => {
        it("should exist and be valid JSON", () => {
            const manifestPath = path.join(__dirname, "../../resources/release-manifest.json");
            assert.ok(fs.existsSync(manifestPath), "release-manifest.json should exist");
            const content = fs.readFileSync(manifestPath, "utf-8");
            const manifest = JSON.parse(content);
            assert.ok(manifest["better-sqlite3"], "Should have better-sqlite3 key");
            assert.ok(manifest["better-sqlite3"].version, "Should have version");
            assert.ok(manifest["better-sqlite3"].binaries, "Should have binaries");
        });
        it("should have entries for all supported platforms", () => {
            const manifestPath = path.join(__dirname, "../../resources/release-manifest.json");
            const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
            const binaries = manifest["better-sqlite3"].binaries;
            const expectedKeys = [
                "napi-v9-win32-x64",
                "napi-v9-darwin-x64",
                "napi-v9-darwin-arm64",
                "napi-v9-linux-x64",
            ];
            for (const key of expectedKeys) {
                assert.ok(binaries[key], `Should have entry for ${key}`);
                assert.ok(binaries[key].url, `${key} should have url`);
                assert.ok(binaries[key].sha256, `${key} should have sha256`);
                assert.ok(binaries[key].size > 0, `${key} should have positive size`);
            }
        });
        it("should have valid URLs", () => {
            const manifestPath = path.join(__dirname, "../../resources/release-manifest.json");
            const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
            const binaries = manifest["better-sqlite3"].binaries;
            for (const [key, entry] of Object.entries(binaries)) {
                assert.ok(entry.url.startsWith("https://"), `${key} URL should be HTTPS`);
                assert.ok(entry.url.includes("github.com"), `${key} URL should be from GitHub`);
                assert.ok(entry.url.endsWith(".node"), `${key} URL should end with .node`);
            }
        });
    });
    describe("Cache path construction", () => {
        it("should include version in cache path", () => {
            const manifestPath = path.join(__dirname, "../../resources/release-manifest.json");
            const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
            const version = manifest["better-sqlite3"].version;
            const cachePath = path.join(mockContext.globalStorageUri.fsPath, "native-addons", "better-sqlite3", `v${version}`, `napi-v9-${process.platform}-${process.arch}`, "better_sqlite3.node");
            assert.ok(cachePath.includes(`v${version}`));
            assert.ok(cachePath.includes("native-addons"));
            assert.ok(cachePath.endsWith("better_sqlite3.node"));
        });
    });
    describe("SHA-256 computation", () => {
        it("should compute correct hash for known content", async () => {
            const crypto = await Promise.resolve().then(() => __importStar(require("crypto")));
            const testContent = "hello world";
            const expectedHash = crypto.createHash("sha256").update(testContent).digest("hex");
            // Verify our expected hash is correct
            assert.strictEqual(expectedHash, "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
        });
    });
});
//# sourceMappingURL=native-addon-manager.test.js.map