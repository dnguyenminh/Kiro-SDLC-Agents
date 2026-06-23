package com.codeintel.parsers

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class TreeSitterNodeTest {

    private val sampleSource = "class Foo { fun bar() {} }"

    private fun createSampleTree(): TreeSitterNode {
        val barName = ASTNodeData(
            "identifier", startByte = 16, endByte = 19,
            startRow = 0, startCol = 16, endRow = 0, endCol = 19, fieldName = "name",
        )
        val barParams = ASTNodeData(
            "formal_parameters", startByte = 19, endByte = 21,
            startRow = 0, startCol = 19, endRow = 0, endCol = 21, fieldName = "parameters",
        )
        val barBody = ASTNodeData(
            "block", startByte = 22, endByte = 24,
            startRow = 0, startCol = 22, endRow = 0, endCol = 24,
        )
        val barDecl = ASTNodeData(
            "function_declaration", startByte = 12, endByte = 24,
            startRow = 0, startCol = 12, endRow = 0, endCol = 24,
            children = listOf(barName, barParams, barBody),
        )
        val fooName = ASTNodeData(
            "identifier", startByte = 6, endByte = 9,
            startRow = 0, startCol = 6, endRow = 0, endCol = 9, fieldName = "name",
        )
        val classBody = ASTNodeData(
            "class_body", startByte = 10, endByte = 26,
            startRow = 0, startCol = 10, endRow = 0, endCol = 26,
            children = listOf(barDecl),
        )
        val classDecl = ASTNodeData(
            "class_declaration", startByte = 0, endByte = 26,
            startRow = 0, startCol = 0, endRow = 0, endCol = 26,
            children = listOf(fooName, classBody),
        )
        val root = ASTNodeData(
            "program", startByte = 0, endByte = 26,
            startRow = 0, startCol = 0, endRow = 0, endCol = 26,
            children = listOf(classDecl),
        )
        return TreeSitterNode(root, sampleSource)
    }

    @Test
    fun `root node has correct type`() {
        val root = createSampleTree()
        assertEquals("program", root.type)
    }

    @Test
    fun `child access works`() {
        val root = createSampleTree()
        val classNode = root.child(0)
        assertNotNull(classNode)
        assertEquals("class_declaration", classNode.type)
    }

    @Test
    fun `childByFieldName finds named children`() {
        val root = createSampleTree()
        val classNode = root.child(0)!!
        val nameNode = classNode.childByFieldName("name")
        assertNotNull(nameNode)
        assertEquals("identifier", nameNode.type)
        assertEquals("Foo", nameNode.text)
    }

    @Test
    fun `namedChildren filters anonymous nodes`() {
        val root = createSampleTree()
        assertEquals(1, root.namedChildCount)
    }

    @Test
    fun `startPoint and endPoint correct`() {
        val root = createSampleTree()
        assertEquals(Point(0, 0), root.startPoint)
        assertEquals(Point(0, 26), root.endPoint)
    }

    @Test
    fun `hasError is false for valid tree`() {
        val root = createSampleTree()
        assertFalse(root.hasError)
    }

    @Test
    fun `hasError is true when ERROR node present`() {
        val errorNode = ASTNodeData("ERROR", startByte = 0, endByte = 5)
        val root = ASTNodeData("program", children = listOf(errorNode))
        val node = TreeSitterNode(root, "bad code")
        assertTrue(node.hasError)
    }

    @Test
    fun `text extraction works`() {
        val root = createSampleTree()
        val classNode = root.child(0)!!
        assertEquals(sampleSource, classNode.text)
    }

    @Test
    fun `parent reference is null for root`() {
        val root = createSampleTree()
        assertNull(root.parent)
    }

    @Test
    fun `parent reference set for children`() {
        val root = createSampleTree()
        val child = root.child(0)!!
        assertNotNull(child.parent)
        assertEquals("program", child.parent!!.type)
    }

    @Test
    fun `children list has correct size`() {
        val root = createSampleTree()
        assertEquals(1, root.childCount)
        val classNode = root.child(0)!!
        assertEquals(2, classNode.childCount)
    }
}
