"use strict";
/**
 * KSA-161: Core complexity calculation engine.
 * Delegates to language-specific counters via strategy pattern.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplexityCalculator = void 0;
const TypeScriptCounter_js_1 = require("./counters/TypeScriptCounter.js");
const PythonCounter_js_1 = require("./counters/PythonCounter.js");
const JavaCounter_js_1 = require("./counters/JavaCounter.js");
const KotlinCounter_js_1 = require("./counters/KotlinCounter.js");
const GoCounter_js_1 = require("./counters/GoCounter.js");
class ComplexityCalculator {
    counters = new Map();
    constructor() {
        // Register built-in counters
        this.registerCounter(new TypeScriptCounter_js_1.TypeScriptCounter());
        this.registerCounter(new PythonCounter_js_1.PythonCounter());
        this.registerCounter(new JavaCounter_js_1.JavaCounter());
        this.registerCounter(new KotlinCounter_js_1.KotlinCounter());
        this.registerCounter(new GoCounter_js_1.GoCounter());
        // JS uses same rules as TS
        this.counters.set('javascript', new TypeScriptCounter_js_1.TypeScriptCounter());
    }
    /** Register a language-specific counter. */
    registerCounter(counter) {
        this.counters.set(counter.language, counter);
    }
    /** Calculate cyclomatic complexity for a function body AST node. */
    calculate(bodyNode, language) {
        const counter = this.counters.get(language);
        if (!counter)
            return null;
        const counts = counter.countDecisionPoints(bodyNode);
        const nestingDepth = counter.calculateNestingDepth(bodyNode);
        const earlyReturns = counter.countEarlyReturns(bodyNode);
        const cc = 1 + counts.branches + counts.loops + counts.logical_ops + counts.exception_handlers;
        return {
            cyclomatic_complexity: cc,
            branches: counts.branches,
            loops: counts.loops,
            logical_ops: counts.logical_ops,
            exception_handlers: counts.exception_handlers,
            nesting_depth: nestingDepth,
            early_returns: earlyReturns,
        };
    }
    /** Check if a language is supported. */
    supportsLanguage(language) {
        return this.counters.has(language);
    }
    /** Get list of supported languages. */
    getSupportedLanguages() {
        return [...this.counters.keys()];
    }
}
exports.ComplexityCalculator = ComplexityCalculator;
//# sourceMappingURL=ComplexityCalculator.js.map