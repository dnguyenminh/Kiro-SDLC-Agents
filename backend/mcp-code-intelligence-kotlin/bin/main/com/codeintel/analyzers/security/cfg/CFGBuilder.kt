/**
 * KSA-164: CFG Builder — Constructs control flow graphs from AST function nodes.
 */
package com.codeintel.analyzers.security.cfg

import com.codeintel.analyzers.security.BlockType
import com.codeintel.analyzers.security.EdgeType
import com.codeintel.parsers.SyntaxNode

class CFGBuilder {
    private var blockCounter = 0
    private lateinit var cfg: ControlFlowGraph

    fun build(functionNode: SyntaxNode, language: String): ControlFlowGraph {
        blockCounter = 0
        val entry = newBlock(BlockType.ENTRY)
        cfg = ControlFlowGraph(entry)

        val exit = newBlock(BlockType.EXIT)
        cfg.addBlock(exit)

        val body = getFunctionBody(functionNode, language)
        if (body == null) {
            cfg.addEdge(entry, exit, EdgeType.SEQUENTIAL)
            return cfg
        }

        val lastBlock = processStatements(body, entry, exit)
        if (lastBlock != null && lastBlock !== exit) {
            cfg.addEdge(lastBlock, exit, EdgeType.SEQUENTIAL)
        }
        return cfg
    }

    private fun getFunctionBody(node: SyntaxNode, language: String): SyntaxNode? {
        node.childByFieldName("body")?.let { return it }
        for (child in node.namedChildren) {
            if (child.type in listOf("statement_block", "block")) return child
        }
        return null
    }

    private fun processStatements(blockNode: SyntaxNode, currentBlock: BasicBlock, exitBlock: BasicBlock): BasicBlock? {
        var active: BasicBlock? = currentBlock
        for (child in blockNode.namedChildren) {
            if (active == null) break
            active = processStatement(child, active, exitBlock)
        }
        return active
    }

    private fun processStatement(stmt: SyntaxNode, currentBlock: BasicBlock, exitBlock: BasicBlock): BasicBlock? {
        return when (stmt.type) {
            "if_statement" -> handleIf(stmt, currentBlock, exitBlock)
            "while_statement", "do_statement" -> handleWhile(stmt, currentBlock, exitBlock)
            "for_statement", "for_in_statement" -> handleFor(stmt, currentBlock, exitBlock)
            "try_statement" -> handleTryCatch(stmt, currentBlock, exitBlock)
            "switch_statement" -> handleSwitch(stmt, currentBlock, exitBlock)
            "return_statement" -> {
                currentBlock.addStatement(stmt)
                cfg.addEdge(currentBlock, exitBlock, EdgeType.RETURN)
                null
            }
            "throw_statement" -> {
                currentBlock.addStatement(stmt)
                cfg.addEdge(currentBlock, exitBlock, EdgeType.EXCEPTION)
                null
            }
            "break_statement", "continue_statement" -> {
                currentBlock.addStatement(stmt)
                null
            }
            else -> {
                currentBlock.addStatement(stmt)
                currentBlock
            }
        }
    }

    private fun handleIf(node: SyntaxNode, currentBlock: BasicBlock, exitBlock: BasicBlock): BasicBlock? {
        node.childByFieldName("condition")?.let { currentBlock.addStatement(it) }

        val mergeBlock = newBlock(BlockType.NORMAL)
        cfg.addBlock(mergeBlock)

        val consequence = node.childByFieldName("consequence")
        val thenBlock = newBlock(BlockType.NORMAL)
        cfg.addBlock(thenBlock)
        cfg.addEdge(currentBlock, thenBlock, EdgeType.BRANCH_TRUE)

        var thenEnd: BasicBlock? = thenBlock
        if (consequence != null) thenEnd = processBlockOrStatement(consequence, thenBlock, exitBlock)
        if (thenEnd != null) cfg.addEdge(thenEnd, mergeBlock, EdgeType.SEQUENTIAL)

        val alternative = node.childByFieldName("alternative")
        if (alternative != null) {
            val elseBlock = newBlock(BlockType.NORMAL)
            cfg.addBlock(elseBlock)
            cfg.addEdge(currentBlock, elseBlock, EdgeType.BRANCH_FALSE)

            val elseBody = if (alternative.type == "else_clause" && alternative.namedChildCount > 0)
                alternative.namedChildren.first() else alternative
            var elseEnd: BasicBlock? = elseBlock
            if (elseBody.type == "if_statement") {
                elseEnd = handleIf(elseBody, elseBlock, exitBlock)
            } else {
                elseEnd = processBlockOrStatement(elseBody, elseBlock, exitBlock)
            }
            if (elseEnd != null) cfg.addEdge(elseEnd, mergeBlock, EdgeType.SEQUENTIAL)
        } else {
            cfg.addEdge(currentBlock, mergeBlock, EdgeType.BRANCH_FALSE)
        }

        return mergeBlock
    }

    private fun handleWhile(node: SyntaxNode, currentBlock: BasicBlock, exitBlock: BasicBlock): BasicBlock? {
        val headerBlock = newBlock(BlockType.LOOP_HEADER)
        cfg.addBlock(headerBlock)
        cfg.addEdge(currentBlock, headerBlock, EdgeType.SEQUENTIAL)

        node.childByFieldName("condition")?.let { headerBlock.addStatement(it) }

        val postLoop = newBlock(BlockType.NORMAL)
        cfg.addBlock(postLoop)

        val body = node.childByFieldName("body")
        val bodyBlock = newBlock(BlockType.NORMAL)
        cfg.addBlock(bodyBlock)
        cfg.addEdge(headerBlock, bodyBlock, EdgeType.BRANCH_TRUE)
        cfg.addEdge(headerBlock, postLoop, EdgeType.LOOP_EXIT)

        var bodyEnd: BasicBlock? = bodyBlock
        if (body != null) bodyEnd = processBlockOrStatement(body, bodyBlock, exitBlock)
        if (bodyEnd != null) cfg.addEdge(bodyEnd, headerBlock, EdgeType.LOOP_BACK)

        return postLoop
    }

    private fun handleFor(node: SyntaxNode, currentBlock: BasicBlock, exitBlock: BasicBlock): BasicBlock? {
        node.childByFieldName("initializer")?.let { currentBlock.addStatement(it) }

        val headerBlock = newBlock(BlockType.LOOP_HEADER)
        cfg.addBlock(headerBlock)
        cfg.addEdge(currentBlock, headerBlock, EdgeType.SEQUENTIAL)

        node.childByFieldName("condition")?.let { headerBlock.addStatement(it) }

        val postLoop = newBlock(BlockType.NORMAL)
        cfg.addBlock(postLoop)

        val body = node.childByFieldName("body")
        val bodyBlock = newBlock(BlockType.NORMAL)
        cfg.addBlock(bodyBlock)
        cfg.addEdge(headerBlock, bodyBlock, EdgeType.BRANCH_TRUE)
        cfg.addEdge(headerBlock, postLoop, EdgeType.LOOP_EXIT)

        var bodyEnd: BasicBlock? = bodyBlock
        if (body != null) bodyEnd = processBlockOrStatement(body, bodyBlock, exitBlock)

        node.childByFieldName("increment")?.let { if (bodyEnd != null) bodyEnd!!.addStatement(it) }
        if (bodyEnd != null) cfg.addEdge(bodyEnd!!, headerBlock, EdgeType.LOOP_BACK)

        return postLoop
    }

    private fun handleTryCatch(node: SyntaxNode, currentBlock: BasicBlock, exitBlock: BasicBlock): BasicBlock? {
        val mergeBlock = newBlock(BlockType.NORMAL)
        cfg.addBlock(mergeBlock)

        val tryBody = node.childByFieldName("body")
        val tryBlock = newBlock(BlockType.NORMAL)
        cfg.addBlock(tryBlock)
        cfg.addEdge(currentBlock, tryBlock, EdgeType.SEQUENTIAL)

        var tryEnd: BasicBlock? = tryBlock
        if (tryBody != null) tryEnd = processBlockOrStatement(tryBody, tryBlock, exitBlock)
        if (tryEnd != null) cfg.addEdge(tryEnd, mergeBlock, EdgeType.SEQUENTIAL)

        val handler = node.childByFieldName("handler")
        if (handler != null) {
            val catchBlock = newBlock(BlockType.CATCH)
            cfg.addBlock(catchBlock)
            cfg.addEdge(tryBlock, catchBlock, EdgeType.EXCEPTION)

            val catchBody = handler.childByFieldName("body")
            var catchEnd: BasicBlock? = catchBlock
            if (catchBody != null) catchEnd = processBlockOrStatement(catchBody, catchBlock, exitBlock)
            if (catchEnd != null) cfg.addEdge(catchEnd, mergeBlock, EdgeType.SEQUENTIAL)
        }

        val finalizer = node.childByFieldName("finalizer")
        if (finalizer != null) {
            val finallyBlock = newBlock(BlockType.NORMAL)
            cfg.addBlock(finallyBlock)
            cfg.addEdge(mergeBlock, finallyBlock, EdgeType.SEQUENTIAL)
            if (finalizer.namedChildCount > 0) {
                processBlockOrStatement(finalizer.namedChildren.first(), finallyBlock, exitBlock)
            }
            return finallyBlock
        }

        return mergeBlock
    }

    private fun handleSwitch(node: SyntaxNode, currentBlock: BasicBlock, exitBlock: BasicBlock): BasicBlock? {
        node.childByFieldName("value")?.let { currentBlock.addStatement(it) }

        val mergeBlock = newBlock(BlockType.NORMAL)
        cfg.addBlock(mergeBlock)

        val body = node.childByFieldName("body") ?: return mergeBlock

        for (caseNode in body.namedChildren) {
            val caseBlock = newBlock(BlockType.NORMAL)
            cfg.addBlock(caseBlock)
            cfg.addEdge(currentBlock, caseBlock, EdgeType.BRANCH_TRUE)

            var caseEnd: BasicBlock? = caseBlock
            for (child in caseNode.namedChildren) {
                if (caseEnd == null) break
                if (child.type in listOf("switch_case", "switch_default")) continue
                caseEnd = processStatement(child, caseEnd, exitBlock)
            }
            if (caseEnd != null) cfg.addEdge(caseEnd, mergeBlock, EdgeType.SEQUENTIAL)
        }

        return mergeBlock
    }

    private fun processBlockOrStatement(node: SyntaxNode, currentBlock: BasicBlock, exitBlock: BasicBlock): BasicBlock? {
        return if (node.type in listOf("statement_block", "block")) {
            processStatements(node, currentBlock, exitBlock)
        } else {
            processStatement(node, currentBlock, exitBlock)
        }
    }

    private fun newBlock(type: BlockType): BasicBlock {
        return BasicBlock(blockCounter++, type)
    }
}
