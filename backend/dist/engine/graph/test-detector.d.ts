/**
 * KSA-156: Test Detector - identifies test files and finds related tests for symbols.
 */
import Database from 'better-sqlite3';
import { ResolvedSymbol } from './symbol-resolver.js';
export interface RelatedTest {
    file: string;
    reason: string;
}
export declare class TestDetector {
    private db;
    private static readonly TEST_PATH_PATTERNS;
    private static readonly TEST_FILE_PATTERNS;
    constructor(db: Database.Database);
    /** Check if a file path is a test file. */
    isTestFile(filePath: string): boolean;
    /** Find test files related to the given symbols and impacts. */
    findRelatedTests(symbols: ResolvedSymbol[], impactFiles: string[]): RelatedTest[];
}
