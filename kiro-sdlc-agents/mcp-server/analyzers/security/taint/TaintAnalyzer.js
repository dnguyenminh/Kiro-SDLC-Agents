"use strict";
/**
 * KSA-164: Taint Analyzer — Main taint analysis engine.
 * Combines CFG, data flow, and taint propagation to find source-to-sink paths.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaintAnalyzer = void 0;
const CFGBuilder_js_1 = require("../cfg/CFGBuilder.js");
const DataFlowAnalyzer_js_1 = require("../dataflow/DataFlowAnalyzer.js");
const TaintRegistry_js_1 = require("./TaintRegistry.js");
const TaintPropagator_js_1 = require("./TaintPropagator.js");
class TaintAnalyzer {
    cfgBuilder;
    dataFlowAnalyzer;
    registry;
    propagator;
    cfgCache = new Map();
    MAX_CACHE = 100;
    constructor(registry) {
        this.cfgBuilder = new CFGBuilder_js_1.CFGBuilder();
        this.dataFlowAnalyzer = new DataFlowAnalyzer_js_1.DataFlowAnalyzer();
        this.registry = registry ?? new TaintRegistry_js_1.TaintRegistry();
        this.propagator = new TaintPropagator_js_1.TaintPropagator(this.registry);
    }
    /** Perform taint analysis on a function node. */
    analyze(functionNode, language, options = {}) {
        const maxPathLength = options.maxPathLength ?? 20;
        // Build CFG
        const cfg = this.cfgBuilder.build(functionNode, language);
        // Propagate taint through CFG blocks in topological order
        const blockStates = new Map();
        const initialState = new Map();
        blockStates.set(cfg.entry.id, initialState);
        // Identify sources from function parameters
        this.identifyParamSources(functionNode, language, initialState);
        // Forward propagation through CFG
        for (const block of cfg.reversePostOrder()) {
            // Merge predecessor states
            const predecessors = cfg.getPredecessors(block);
            let mergedState;
            if (predecessors.length === 0) {
                mergedState = new Map(blockStates.get(block.id) ?? initialState);
            }
            else {
                mergedState = new Map();
                for (const pred of predecessors) {
                    const predState = blockStates.get(pred.id);
                    if (predState) {
                        for (const [key, val] of predState) {
                            if (!mergedState.has(key))
                                mergedState.set(key, val);
                        }
                    }
                }
            }
            // Propagate through block
            const outState = this.propagator.propagateBlock(block, mergedState);
            blockStates.set(block.id, outState);
        }
        // Collect taint paths: find sinks that receive tainted data
        const paths = [];
        const sources = [];
        const sinks = [];
        for (const block of cfg.blocks) {
            const state = blockStates.get(block.id);
            if (!state)
                continue;
            for (const stmt of block.statements) {
                const sinkInfo = this.findSink(stmt.node, state, language);
                if (sinkInfo) {
                    sinks.push(sinkInfo.sink);
                    if (sinkInfo.taintState) {
                        const path = {
                            source: {
                                variable: sinkInfo.taintState.variable,
                                type: sinkInfo.taintState.sourceType,
                                line: sinkInfo.taintState.sourceLine,
                                expression: sinkInfo.taintState.variable,
                            },
                            sink: sinkInfo.sink,
                            chain: sinkInfo.taintState.steps.slice(0, maxPathLength),
                            sanitized: false,
                            length: sinkInfo.taintState.steps.length,
                        };
                        paths.push(path);
                        // Track unique sources
                        if (!sources.find(s => s.variable === path.source.variable && s.line === path.source.line)) {
                            sources.push(path.source);
                        }
                    }
                }
            }
        }
        // Filter by options
        let filteredPaths = paths;
        if (options.sinkTypes) {
            filteredPaths = filteredPaths.filter(p => options.sinkTypes.includes(p.sink.type));
        }
        if (options.sourceTypes) {
            filteredPaths = filteredPaths.filter(p => options.sourceTypes.includes(p.source.type));
        }
        if (!options.includeSanitized) {
            filteredPaths = filteredPaths.filter(p => !p.sanitized);
        }
        return {
            paths: filteredPaths,
            sources,
            sinks,
            sanitizers: [],
        };
    }
    /** Get the taint registry for external configuration. */
    getRegistry() {
        return this.registry;
    }
    /** Identify taint sources from function parameters. */
    identifyParamSources(functionNode, language, state) {
        const params = functionNode.childForFieldName('parameters');
        if (!params)
            return;
        for (let i = 0; i < params.namedChildCount; i++) {
            const param = params.namedChild(i);
            if (!param)
                continue;
            let paramName = null;
            if (param.type === 'identifier') {
                paramName = param.text;
            }
            else if (param.type === 'required_parameter' || param.type === 'optional_parameter') {
                const nameNode = param.childForFieldName('pattern') ?? param.childForFieldName('name');
                if (nameNode)
                    paramName = nameNode.text;
            }
            else if (param.type === 'formal_parameters') {
                continue;
            }
            if (!paramName)
                continue;
            // Common HTTP handler parameter names
            const httpParams = ['req', 'request', 'ctx', 'context'];
            if (httpParams.includes(paramName)) {
                state.set(paramName, {
                    variable: paramName,
                    tainted: true,
                    sourceType: 'http_param',
                    sourceLine: param.startPosition.row + 1,
                    steps: [],
                });
            }
        }
    }
    /** Find a taint sink in a statement and check if it receives tainted data. */
    findSink(node, state, language) {
        if (node.type === 'call_expression' || node.type === 'expression_statement') {
            const callNode = node.type === 'expression_statement' ? node.namedChild(0) : node;
            if (!callNode || callNode.type !== 'call_expression')
                return null;
            const fn = callNode.childForFieldName('function');
            if (!fn)
                return null;
            const sinkMatch = this.registry.matchSink(fn.text, language);
            if (!sinkMatch)
                return null;
            const sink = {
                function: fn.text,
                type: sinkMatch.type,
                line: callNode.startPosition.row + 1,
                expression: callNode.text.slice(0, 100),
                paramIndex: sinkMatch.paramIndex,
            };
            // Check if the relevant argument is tainted
            const args = callNode.childForFieldName('arguments');
            if (args) {
                const targetArg = args.namedChild(sinkMatch.paramIndex);
                if (targetArg) {
                    const taintInfo = this.propagator.evaluateExpression(targetArg, state);
                    if (taintInfo.tainted) {
                        return {
                            sink,
                            taintState: {
                                variable: targetArg.text.slice(0, 50),
                                tainted: true,
                                sourceType: taintInfo.sourceType,
                                sourceLine: taintInfo.sourceLine,
                                steps: taintInfo.steps,
                            },
                        };
                    }
                }
            }
            return { sink, taintState: null };
        }
        // Recurse into child expressions
        for (let i = 0; i < node.namedChildCount; i++) {
            const child = node.namedChild(i);
            if (child) {
                const result = this.findSink(child, state, language);
                if (result?.taintState)
                    return result;
            }
        }
        return null;
    }
}
exports.TaintAnalyzer = TaintAnalyzer;
//# sourceMappingURL=TaintAnalyzer.js.map