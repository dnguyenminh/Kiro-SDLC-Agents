/**
 * KSA-156: Test Detector - identifies test files and finds related tests for symbols.
 */
import * as path from 'path';
export class TestDetector {
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
//# sourceMappingURL=test-detector.js.map