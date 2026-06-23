"use strict";
/**
 * Max recursion depth guard — prevents infinite orchestrator loops.
 * Reads --depth and --max-depth from CLI args.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRecursionArgs = parseRecursionArgs;
exports.isDepthExceeded = isDepthExceeded;
exports.childDepthArgs = childDepthArgs;
/** Parse recursion depth from CLI args. */
function parseRecursionArgs(args = process.argv.slice(2)) {
    let currentDepth = 0;
    let maxDepth = 5;
    const depthIdx = args.indexOf('--depth');
    if (depthIdx >= 0 && args[depthIdx + 1]) {
        currentDepth = parseInt(args[depthIdx + 1], 10) || 0;
    }
    const maxIdx = args.indexOf('--max-depth');
    if (maxIdx >= 0 && args[maxIdx + 1]) {
        maxDepth = parseInt(args[maxIdx + 1], 10) || 5;
    }
    return { currentDepth, maxDepth };
}
/** Check if orchestration should be disabled due to depth limit. */
function isDepthExceeded(state) {
    return state.currentDepth >= state.maxDepth;
}
/** Get child depth args for spawning child servers. */
function childDepthArgs(state) {
    return ['--depth', String(state.currentDepth + 1), '--max-depth', String(state.maxDepth)];
}
//# sourceMappingURL=recursion-guard.js.map