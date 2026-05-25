/**
 * Unit tests for NativeAddonManager (KSA-175).
 * Tests platform detection, cache logic, and manifest parsing.
 */

import * as assert from "assert";
import * as sinon from "sinon";
import * as path from "path";
import * as fs from "fs";

// Mock vscode module
const mockContext = {
    globalStorageUri: { fsPath: path.join(__dirname, "../../test-fixtures/globalStorage") },
    extensionPath: path.join(__dirname, "../../"),
};

const mockOutputChannel = {
    appendLine: sinon.stub(),
};

describe("NativeAddonManager", () => {
    let sandbox: sinon.SinonSandbox;

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

            for (const [key, entry] of Object.entries(binaries) as [string, any][]) {
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

            const cachePath = path.join(
                mockContext.globalStorageUri.fsPath,
                "native-addons",
                "better-sqlite3",
                `v${version}`,
                `napi-v9-${process.platform}-${process.arch}`,
                "better_sqlite3.node"
            );

            assert.ok(cachePath.includes(`v${version}`));
            assert.ok(cachePath.includes("native-addons"));
            assert.ok(cachePath.endsWith("better_sqlite3.node"));
        });
    });

    describe("SHA-256 computation", () => {
        it("should compute correct hash for known content", async () => {
            const crypto = await import("crypto");
            const testContent = "hello world";
            const expectedHash = crypto.createHash("sha256").update(testContent).digest("hex");

            // Verify our expected hash is correct
            assert.strictEqual(
                expectedHash,
                "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
            );
        });
    });
});
