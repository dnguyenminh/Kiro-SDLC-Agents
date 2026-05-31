"use strict";
/**
 * KSA-161: Java decision point counter.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.JavaCounter = void 0;
const BaseNodeCounter_js_1 = require("./BaseNodeCounter.js");
class JavaCounter extends BaseNodeCounter_js_1.BaseNodeCounter {
    language = 'java';
    branchNodeTypes = [
        'if_statement',
        'switch_expression',
        'ternary_expression',
    ];
    loopNodeTypes = [
        'for_statement',
        'enhanced_for_statement',
        'while_statement',
        'do_statement',
    ];
    logicalOperators = ['&&', '||'];
    exceptionNodeTypes = ['catch_clause'];
    isLogicalOp(node) {
        if (node.type === 'binary_expression') {
            const op = node.childForFieldName('operator');
            if (op && this.logicalOperators.includes(op.text))
                return true;
        }
        return false;
    }
}
exports.JavaCounter = JavaCounter;
//# sourceMappingURL=JavaCounter.js.map