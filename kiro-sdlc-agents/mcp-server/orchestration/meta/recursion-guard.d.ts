/**
 * Max recursion depth guard — prevents infinite orchestrator loops.
 * Reads --depth and --max-depth from CLI args.
 */
export interface RecursionState {
    currentDepth: number;
    maxDepth: number;
}
/** Parse recursion depth from CLI args. */
export declare function parseRecursionArgs(args?: string[]): RecursionState;
/** Check if orchestration should be disabled due to depth limit. */
export declare function isDepthExceeded(state: RecursionState): boolean;
/** Get child depth args for spawning child servers. */
export declare function childDepthArgs(state: RecursionState): string[];
//# sourceMappingURL=recursion-guard.d.ts.map