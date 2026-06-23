/**
 * KSA-164: Basic Block — Fundamental unit of a control flow graph.
 */
package com.codeintel.analyzers.security.cfg

import com.codeintel.analyzers.security.*
import com.codeintel.parsers.SyntaxNode

class BasicBlock(val id: Int, val type: BlockType) {
    val statements: MutableList<Statement> = mutableListOf()
    var startLine: Int = 0
    var endLine: Int = 0

    fun addStatement(node: SyntaxNode) {
        val stmt = Statement(
            node = node,
            line = node.startPoint.row + 1,
            type = node.type,
            text = node.text.take(120)
        )
        statements.add(stmt)
        if (statements.size == 1) startLine = stmt.line
        endLine = stmt.line
    }

    fun getDefinitions(): List<VariableDef> {
        return statements.flatMap { extractDefinitions(it.node, id) }
    }

    fun getUses(): List<VariableUse> {
        return statements.flatMap { extractUses(it.node, id) }
    }

    val isEmpty: Boolean get() = statements.isEmpty()
}

private fun extractDefinitions(node: SyntaxNode, blockId: Int): List<VariableDef> {
    val defs = mutableListOf<VariableDef>()
    val ntype = node.type

    if (ntype in listOf("lexical_declaration", "variable_declaration")) {
        for (child in node.namedChildren) {
            if (child.type == "variable_declarator") {
                val nameNode = child.childByFieldName("name")
                if (nameNode != null) {
                    defs.add(VariableDef(nameNode.text, nameNode.startPoint.row + 1, blockId, nameNode))
                }
            }
        }
    }

    if (ntype in listOf("assignment_expression", "augmented_assignment_expression")) {
        val left = node.childByFieldName("left")
        if (left != null && left.type == "identifier") {
            defs.add(VariableDef(left.text, left.startPoint.row + 1, blockId, left))
        }
    }

    if (ntype == "expression_statement" && node.namedChildCount > 0) {
        val expr = node.namedChildren.firstOrNull()
        if (expr != null) defs.addAll(extractDefinitions(expr, blockId))
    }

    if (ntype == "assignment") {
        val left = node.childByFieldName("left")
        if (left != null && left.type == "identifier") {
            defs.add(VariableDef(left.text, left.startPoint.row + 1, blockId, left))
        }
    }

    if (ntype in listOf("for_statement", "for_in_statement")) {
        val init = node.childByFieldName("initializer") ?: node.childByFieldName("left")
        if (init != null && init.type == "identifier") {
            defs.add(VariableDef(init.text, init.startPoint.row + 1, blockId, init))
        }
    }

    return defs
}

private fun extractUses(node: SyntaxNode, blockId: Int): List<VariableUse> {
    val uses = mutableListOf<VariableUse>()
    val seen = mutableSetOf<String>()
    collectIdentifiers(node, uses, blockId, seen)
    return uses
}

private fun collectIdentifiers(node: SyntaxNode, uses: MutableList<VariableUse>, blockId: Int, seen: MutableSet<String>) {
    if (node.type == "identifier") {
        val key = "${node.text}:${node.startPoint.row}"
        if (key !in seen) {
            seen.add(key)
            uses.add(VariableUse(node.text, node.startPoint.row + 1, blockId, node))
        }
        return
    }
    for (child in node.children) {
        collectIdentifiers(child, uses, blockId, seen)
    }
}
