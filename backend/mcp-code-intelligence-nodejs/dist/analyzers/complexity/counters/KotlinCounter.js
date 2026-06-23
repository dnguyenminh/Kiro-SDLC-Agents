"use strict";
/**
 * KSA-161: Kotlin decision point counter.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.KotlinCounter = void 0;
const BaseNodeCounter_js_1 = require("./BaseNodeCounter.js");
class KotlinCounter extends BaseNodeCounter_js_1.BaseNodeCounter {
    language = 'kotlin';
    branchNodeTypes = [
        'if_expression',
        'when_entry',
        'elvis_expression',
    ];
    loopNodeTypes = [
        'for_statement',
        'while_statement',
        'do_while_statement',
    ];
    logicalOperators = ['&&', '||'];
    exceptionNodeTypes = ['catch_block'];
    isLogicalOp(node) {
        if (node.type === 'conjunction_expression' || node.type === 'disjunction_expression') {
            return true;
        }
        if (node.type === 'binary_expression') {
            const op = node.childForFieldName('operator');
            if (op && this.logicalOperators.includes(op.text))
                return true;
        }
        return false;
    }
    getReturnNodeTypes() {
        return ['jump_expression']; // Kotlin uses jump_expression for return
    }
}
exports.KotlinCounter = KotlinCounter;
//# sourceMappingURL=KotlinCounter.js.map