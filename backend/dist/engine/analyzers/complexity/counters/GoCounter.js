/**
 * KSA-161: Go decision point counter.
 */
import { BaseNodeCounter } from './BaseNodeCounter.js';
export class GoCounter extends BaseNodeCounter {
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
//# sourceMappingURL=GoCounter.js.map