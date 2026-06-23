/**
 * KSA-161: Java decision point counter.
 */
import { BaseNodeCounter } from './BaseNodeCounter.js';
export class JavaCounter extends BaseNodeCounter {
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
//# sourceMappingURL=JavaCounter.js.map