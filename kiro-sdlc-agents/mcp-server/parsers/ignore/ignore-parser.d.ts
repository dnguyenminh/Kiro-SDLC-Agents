/**
 * KSA-169: Ignore Parser — Parse .codeintelignore files (gitignore syntax).
 * Supports glob patterns, negation (!), and directory markers (/).
 */
export interface IgnorePattern {
    pattern: string;
    regex: RegExp;
    isNegation: boolean;
    isDirectory: boolean;
    sourceFile: string;
}
export declare const DEFAULT_IGNORE_PATTERNS: string[];
export declare class IgnoreParser {
    private patterns;
    constructor();
    parseFile(filePath: string): void;
    shouldIgnore(filePath: string): boolean;
    getPatterns(): IgnorePattern[];
    addPatterns(patterns: string[], sourceFile: string): void;
    private parsePattern;
    private globToRegex;
}
export declare function createIgnoreParser(workspace: string): IgnoreParser;
//# sourceMappingURL=ignore-parser.d.ts.map