/**
 * KSA-164: Taint Analyzer — Main taint analysis engine.
 * Combines CFG, data flow, and taint propagation to find source-to-sink paths.
 */
import type { SyntaxNode } from '../../../parsers/types.js';
import { TaintRegistry } from './TaintRegistry.js';
import type { TaintResult, TaintOptions } from '../types.js';
export declare class TaintAnalyzer {
    private cfgBuilder;
    private dataFlowAnalyzer;
    private registry;
    private propagator;
    private cfgCache;
    private readonly MAX_CACHE;
    constructor(registry?: TaintRegistry);
    /** Perform taint analysis on a function node. */
    analyze(functionNode: SyntaxNode, language: string, options?: TaintOptions): TaintResult;
    /** Get the taint registry for external configuration. */
    getRegistry(): TaintRegistry;
    /** Identify taint sources from function parameters. */
    private identifyParamSources;
    /** Find a taint sink in a statement and check if it receives tainted data. */
    private findSink;
}
