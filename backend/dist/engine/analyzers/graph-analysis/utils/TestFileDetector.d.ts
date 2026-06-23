/**
 * KSA-163: Test file detection heuristics.
 */
export declare class TestFileDetector {
    private testPatterns;
    private testDirs;
    /** Check if a file path is a test file. */
    isTestFile(filePath: string): boolean;
    /** Check if a symbol name looks like a test function. */
    isTestFunction(symbolName: string): boolean;
}
