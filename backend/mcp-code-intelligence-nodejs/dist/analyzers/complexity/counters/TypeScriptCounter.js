"use strict";
/**
 * KSA-161: TypeScript/JavaScript decision point counter.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeScriptCounter = void 0;
const BaseNodeCounter_js_1 = require("./BaseNodeCounter.js");
class TypeScriptCounter extends BaseNodeCounter_js_1.BaseNodeCounter {
    language = 'typescript';
    branchNodeTypes = [
        'if_statement',
        'switch_case',
        'ternary_expression',
    ];
    loopNodeTypes = [
        'for_statement',
        'for_in_statement',
        'while_statement',
        'do_statement',
    ];
    logicalOperators = ['&&', '||', '??'];
    exceptionNodeTypes = ['catch_clause'];
    isLogicalOp(node) {
        // TypeScript uses binary_expression for && and ||
        if (node.type === 'binary_expression') {
            const op = node.childForFieldName('operator');
            if (op && this.logicalOperators.includes(op.text))
                return true;
        }
        // Optional chaining counted as a branch decision
        if (node.type === 'optional_chain_expression')
            return true;
        return false;
    }
}
exports.TypeScriptCounter = TypeScriptCounter;
//# sourceMappingURL=TypeScriptCounter.js.map