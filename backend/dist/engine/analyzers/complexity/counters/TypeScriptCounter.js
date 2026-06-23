/**
 * KSA-161: TypeScript/JavaScript decision point counter.
 */
import { BaseNodeCounter } from './BaseNodeCounter.js';
export class TypeScriptCounter extends BaseNodeCounter {
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
//# sourceMappingURL=TypeScriptCounter.js.map