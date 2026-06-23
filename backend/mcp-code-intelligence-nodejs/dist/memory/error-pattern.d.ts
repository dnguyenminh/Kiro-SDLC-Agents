/**
 * ErrorPatternMemory — tracks recurring errors and their solutions.
 */
export interface ErrorPattern {
    errorMessage: string;
    context: string;
    rootCause: string;
    solution: string;
    prevention?: string;
    source?: string;
    tags?: string;
}
export declare class ErrorPatternMemory {
    private repo;
    constructor(repo: any);
    /** Record a new error pattern. */
    recordError(pattern: ErrorPattern): number;
    /** Find error patterns. */
    findErrors(limit?: number): any[];
    private formatContent;
}
//# sourceMappingURL=error-pattern.d.ts.map