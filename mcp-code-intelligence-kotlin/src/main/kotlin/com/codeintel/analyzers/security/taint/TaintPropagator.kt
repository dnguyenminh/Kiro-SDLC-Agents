/**
 * KSA-164: Taint Propagator — Propagates taint state through CFG blocks.
 */
package com.codeintel.analyzers.security.taint

import com.codeintel.analyzers.security.TaintSinkType
import com.codeintel.analyzers.security.TaintStep
import com.codeintel.analyzers.security.TaintStepAction
import com.codeintel.analyzers.security.cfg.BasicBlock
import com.codeintel.parsers.SyntaxNode

data class TaintState(
    val variable: String,
    val tainted: Boolean,
    val sourceType: String,
    val sourceLine: Int,
    val steps: List<TaintStep> = emptyList()
)

data class EvalResult(
    val tainted: Boolean,
    val sourceType: String = "",
    val sourceLine: Int = 0,
    val steps: List<TaintStep> = emptyList(),
    val action: TaintStepAction = TaintStepAction.ASSIGN
)

class TaintPropagator(private val registry: TaintRegistry) {

    fun propagateBlock(block: BasicBlock, state: MutableMap<String, TaintState>): MutableMap<String, TaintState> {
        val newState = state.toMutableMap()
        for (stmt in block.statements) {
            propagateStatement(stmt.node, newState)
        }
        return newState
    }

    private fun propagateStatement(node: SyntaxNode, state: MutableMap<String, TaintState>) {
        when (node.type) {
            "lexical_declaration", "variable_declaration" -> handleDeclaration(node, state)
            "expression_statement" -> {
                if (node.namedChildCount > 0) propagateExpression(node.namedChildren.first(), state)
            }
            "assignment_expression", "augmented_assignment_expression" -> handleAssignment(node, state)
        }
    }

    private fun handleDeclaration(node: SyntaxNode, state: MutableMap<String, TaintState>) {
        for (child in node.namedChildren) {
            if (child.type != "variable_declarator") continue
            val nameNode = child.childByFieldName("name") ?: continue
            val valueNode = child.childByFieldName("value") ?: continue

            val varName = nameNode.text
            val taintInfo = evaluateExpression(valueNode, state)

            if (taintInfo.tainted) {
                state[varName] = TaintState(
                    variable = varName, tainted = true,
                    sourceType = taintInfo.sourceType, sourceLine = taintInfo.sourceLine,
                    steps = taintInfo.steps + TaintStep(varName, nameNode.startPoint.row + 1, taintInfo.action, valueNode.text.take(80))
                )
            } else {
                state.remove(varName)
            }
        }
    }

    private fun handleAssignment(node: SyntaxNode, state: MutableMap<String, TaintState>) {
        val left = node.childByFieldName("left") ?: return
        val right = node.childByFieldName("right") ?: return
        if (left.type != "identifier") return

        val varName = left.text
        val taintInfo = evaluateExpression(right, state)

        if (taintInfo.tainted) {
            state[varName] = TaintState(
                variable = varName, tainted = true,
                sourceType = taintInfo.sourceType, sourceLine = taintInfo.sourceLine,
                steps = taintInfo.steps + TaintStep(varName, left.startPoint.row + 1, taintInfo.action, right.text.take(80))
            )
        } else {
            state.remove(varName)
        }
    }

    private fun propagateExpression(node: SyntaxNode, state: MutableMap<String, TaintState>) {
        if (node.type in listOf("assignment_expression", "augmented_assignment_expression")) {
            handleAssignment(node, state)
        }
    }

    fun evaluateExpression(node: SyntaxNode, state: Map<String, TaintState>): EvalResult {
        val notTainted = EvalResult(tainted = false)

        when (node.type) {
            "identifier" -> {
                val existing = state[node.text]
                if (existing?.tainted == true) {
                    return EvalResult(true, existing.sourceType, existing.sourceLine, existing.steps, TaintStepAction.PASS_THROUGH)
                }
                return notTainted
            }
            "member_expression" -> {
                val text = node.text
                val sourceMatch = registry.matchSource(text)
                if (sourceMatch != null) {
                    return EvalResult(true, sourceMatch.type.name.lowercase(), node.startPoint.row + 1, emptyList(), TaintStepAction.ASSIGN)
                }
                val obj = node.childByFieldName("object")
                if (obj != null) {
                    val objTaint = evaluateExpression(obj, state)
                    if (objTaint.tainted) return objTaint.copy(action = TaintStepAction.PASS_THROUGH)
                }
                return notTainted
            }
            "call_expression" -> {
                val fn = node.childByFieldName("function")
                if (fn != null) {
                    if (isSanitizerCall(node)) return notTainted
                    val sourceMatch = registry.matchSource(fn.text)
                    if (sourceMatch != null) {
                        return EvalResult(true, sourceMatch.type.name.lowercase(), node.startPoint.row + 1, emptyList(), TaintStepAction.FUNCTION_CALL)
                    }
                    val args = node.childByFieldName("arguments")
                    if (args != null) {
                        for (arg in args.namedChildren) {
                            val argTaint = evaluateExpression(arg, state)
                            if (argTaint.tainted) return argTaint.copy(action = TaintStepAction.FUNCTION_CALL)
                        }
                    }
                }
                return notTainted
            }
            "template_string" -> {
                for (child in node.namedChildren) {
                    if (child.type == "template_substitution" && child.namedChildCount > 0) {
                        val expr = child.namedChildren.first()
                        val exprTaint = evaluateExpression(expr, state)
                        if (exprTaint.tainted) return exprTaint.copy(action = TaintStepAction.TEMPLATE_LITERAL)
                    }
                }
                return notTainted
            }
            "binary_expression" -> {
                val left = node.childByFieldName("left")
                val right = node.childByFieldName("right")
                if (left != null) {
                    val leftTaint = evaluateExpression(left, state)
                    if (leftTaint.tainted) return leftTaint.copy(action = TaintStepAction.CONCAT)
                }
                if (right != null) {
                    val rightTaint = evaluateExpression(right, state)
                    if (rightTaint.tainted) return rightTaint.copy(action = TaintStepAction.CONCAT)
                }
                return notTainted
            }
            "subscript_expression" -> {
                val obj = node.childByFieldName("object")
                if (obj != null) {
                    val objTaint = evaluateExpression(obj, state)
                    if (objTaint.tainted) return objTaint.copy(action = TaintStepAction.PASS_THROUGH)
                }
                return notTainted
            }
            "await_expression" -> {
                if (node.namedChildCount > 0) return evaluateExpression(node.namedChildren.first(), state)
                return notTainted
            }
            else -> return notTainted
        }
    }

    private fun isSanitizerCall(node: SyntaxNode): Boolean {
        val fn = if (node.type == "call_expression") node.childByFieldName("function") else null
        if (fn == null) return false
        val fnText = fn.text
        val sinkTypes = listOf(TaintSinkType.SQL_QUERY, TaintSinkType.SHELL_EXEC, TaintSinkType.HTML_OUTPUT, TaintSinkType.FILE_PATH, TaintSinkType.URL_FETCH)
        return sinkTypes.any { registry.isSanitizer(fnText, it) }
    }
}
