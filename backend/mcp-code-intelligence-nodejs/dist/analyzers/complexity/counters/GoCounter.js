"use strict";
/**
 * KSA-161: Go decision point counter.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoCounter = void 0;
const BaseNodeCounter_js_1 = require("./BaseNodeCounter.js");
class GoCounter extends BaseNodeCounter_js_1.BaseNodeCounter {
    language = 'go';
    branchNodeTypes = [
        'if_statement',
        'expression_case', // switch case
        'type_case', // type switch case
        'select_statement',
        'communication_case',
    ];
    loopNodeTypes = [
        'for_statement',
    ];
    logicalOperators = ['&&', '||'];
    exceptionNodeTypes = []; // Go uses error returns, not exceptions
    isLogicalOp(node) {
        if (node.type === 'binary_expression') {
            const op = node.childForFieldName('operator');
            if (op && this.logicalOperators.includes(op.text))
                return true;
        }
        return false;
    }
    getReturnNodeTypes() {
        return ['return_statement'];
    }
}
exports.GoCounter = GoCounter;
//# sourceMappingURL=GoCounter.js.map