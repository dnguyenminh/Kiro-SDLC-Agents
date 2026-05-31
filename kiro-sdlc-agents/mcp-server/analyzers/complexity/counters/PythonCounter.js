"use strict";
/**
 * KSA-161: Python decision point counter.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PythonCounter = void 0;
const BaseNodeCounter_js_1 = require("./BaseNodeCounter.js");
class PythonCounter extends BaseNodeCounter_js_1.BaseNodeCounter {
    language = 'python';
    branchNodeTypes = [
        'if_statement',
        'elif_clause',
        'conditional_expression', // ternary: x if cond else y
    ];
    loopNodeTypes = [
        'for_statement',
        'while_statement',
    ];
    logicalOperators = ['and', 'or'];
    exceptionNodeTypes = ['except_clause'];
    isLogicalOp(node) {
        if (node.type === 'boolean_operator') {
            const op = node.childForFieldName('operator');
            if (op && this.logicalOperators.includes(op.text))
                return true;
            // Fallback: check children for 'and'/'or' keywords
            for (let i = 0; i < node.childCount; i++) {
                const child = node.child(i);
                if (child && (child.text === 'and' || child.text === 'or'))
                    return true;
            }
        }
        return false;
    }
    getReturnNodeTypes() {
        return ['return_statement'];
    }
}
exports.PythonCounter = PythonCounter;
//# sourceMappingURL=PythonCounter.js.map