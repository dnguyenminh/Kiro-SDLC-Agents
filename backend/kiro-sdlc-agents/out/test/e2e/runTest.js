"use strict";
/**
 * E2E Test Runner — Runs tests inside Kiro IDE (or VS Code as fallback).
 * Uses @vscode/test-electron with Kiro binary path.
 *
 * Usage:
 *   npm run test:e2e          # Auto-detect Kiro, fallback to VS Code download
 *   npm run test:e2e:kiro     # Force Kiro binary
 *   npm run test:e2e:vscode   # Force VS Code download
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
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const test_electron_1 = require("@vscode/test-electron");
/** Known Kiro installation paths by platform. */
const KIRO_PATHS = {
    win32: [
        path.join(process.env.LOCALAPPDATA || "", "Programs", "Kiro", "Kiro.exe"),
        path.join(process.env.PROGRAMFILES || "", "Kiro", "Kiro.exe"),
    ],
    darwin: [
        "/Applications/Kiro.app/Contents/MacOS/Kiro",
    ],
    linux: [
        "/usr/bin/kiro",
        "/snap/bin/kiro",
        path.join(process.env.HOME || "", ".local", "bin", "kiro"),
    ],
};
/** Find Kiro binary on the current platform. */
function findKiroBinary() {
    const candidates = KIRO_PATHS[process.platform] || [];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return null;
}
async function main() {
    try {
        const extensionDevelopmentPath = path.resolve(__dirname, "../../../");
        const extensionTestsPath = path.resolve(__dirname, "./index");
        const testWorkspace = path.resolve(__dirname, "../../../src/test/e2e/test-workspace");
        // Determine which IDE to use
        const forceKiro = process.argv.includes("--kiro");
        const forceVscode = process.argv.includes("--vscode");
        let vscodeExecutablePath;
        let ideName = "VS Code (downloaded)";
        if (!forceVscode) {
            const kiroBinary = findKiroBinary();
            if (kiroBinary) {
                vscodeExecutablePath = kiroBinary;
                ideName = `Kiro (${kiroBinary})`;
            }
            else if (forceKiro) {
                console.error("❌ Kiro binary not found. Searched:");
                (KIRO_PATHS[process.platform] || []).forEach(p => console.error(`   ${p}`));
                process.exit(1);
            }
        }
        console.log("🧪 E2E Test Configuration:");
        console.log(`   IDE:       ${ideName}`);
        console.log(`   Extension: ${extensionDevelopmentPath}`);
        console.log(`   Tests:     ${extensionTestsPath}`);
        console.log(`   Workspace: ${testWorkspace}`);
        // Use existing Kiro user data to bypass onboarding
        const launchArgs = [
            testWorkspace,
            "--disable-extensions",
        ];
        // If using Kiro, use separate test user-data-dir to avoid conflict with running instance
        if (vscodeExecutablePath && !forceVscode) {
            const testUserData = path.resolve(__dirname, "../../../src/test/e2e/test-user-data");
            if (fs.existsSync(testUserData)) {
                launchArgs.push(`--user-data-dir=${testUserData}`);
                console.log(`   UserData:  ${testUserData} (separate instance)`);
            }
        }
        await (0, test_electron_1.runTests)({
            vscodeExecutablePath,
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs,
        });
        console.log("✅ E2E tests passed!");
    }
    catch (err) {
        console.error("❌ Failed to run E2E tests:", err);
        process.exit(1);
    }
}
main();
//# sourceMappingURL=runTest.js.map