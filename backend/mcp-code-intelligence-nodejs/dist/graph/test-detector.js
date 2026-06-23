"use strict";
/**
 * KSA-156: Test Detector - identifies test files and finds related tests for symbols.
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
exports.TestDetector = void 0;
const path = __importStar(require("path"));
class TestDetector {
    db;
    static TEST_PATH_PATTERNS = [
        /\/tests?\//i,
        /\/__tests__\//,
        /\/spec\//i,
    ];
    static TEST_FILE_PATTERNS = [
        /\.test\.[tj]sx?$/,
        /\.spec\.[tj]sx?$/,
        /Test\.kt$/,
        /_test\.py$/,
        /^test_.*\.py$/,
    ];
    constructor(db) {
        this.db = db;
    }
    /** Check if a file path is a test file. */
    isTestFile(filePath) {
        const basename = path.basename(filePath);
        return TestDetector.TEST_PATH_PATTERNS.some(p => p.test(filePath)) ||
            TestDetector.TEST_FILE_PATTERNS.some(p => p.test(basename));
    }
    /** Find test files related to the given symbols and impacts. */
    findRelatedTests(symbols, impactFiles) {
        const results = [];
        const seen = new Set();
        for (const sym of symbols) {
            const sourceBasename = path.basename(sym.filePath, path.extname(sym.filePath));
            // Find test files that import the source file
            const testFiles = this.db.prepare(`
        SELECT DISTINCT file_path FROM relationships
        WHERE kind = 'imports' AND target_symbol LIKE ?
      `).all(`%${sourceBasename}%`);
            for (const tf of testFiles) {
                if (this.isTestFile(tf.file_path) && !seen.has(tf.file_path)) {
                    seen.add(tf.file_path);
                    results.push({ file: tf.file_path, reason: `Tests ${sym.name}` });
                }
            }
        }
        // Check if any impact targets are in test files
        for (const file of impactFiles) {
            if (this.isTestFile(file) && !seen.has(file)) {
                seen.add(file);
                results.push({ file, reason: 'Calls modified symbol' });
            }
        }
        return results;
    }
}
exports.TestDetector = TestDetector;
//# sourceMappingURL=test-detector.js.map