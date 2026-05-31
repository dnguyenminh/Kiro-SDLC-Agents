/**
 * KSA-162: HTTP Handler Detector — Detects HTTP route handlers.
 */
import type { EntryPoint } from '../types.js';
import { PatternRegistry } from '../PatternRegistry.js';
interface SymbolInput {
    id: number;
    name: string;
    decorators?: string[];
    parentName?: string | null;
    filePath: string;
    startLine: number;
}
export declare class HTTPHandlerDetector {
    private registry;
    private routeResolver;
    constructor(registry: PatternRegistry);
    /** Detect HTTP handlers from symbols and source. */
    detectFromSymbols(symbols: SymbolInput[], framework: string, source: string): EntryPoint[];
    private detectHandler;
    private findControllerPrefix;
    private extractMethodAndPath;
    private extractPathArg;
    private extractMethodFromCall;
    private extractPathFromContext;
    private getSymbolContext;
    private detectMiddleware;
    private hasAuthIndicator;
}
export {};
//# sourceMappingURL=HTTPHandlerDetector.d.ts.map