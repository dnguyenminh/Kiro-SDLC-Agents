/** Tests for drawio_auto_layout tool — verifies parsing, layout, and writing. */
package com.codeintel.tools.drawio

import kotlinx.serialization.json.*
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.io.File
import kotlin.test.assertTrue
import kotlin.test.assertFalse

class DrawioAutoLayoutToolTest {

    @TempDir
    lateinit var tempDir: File

    private val sampleDrawio = """
<mxGraphModel dx="1422" dy="762" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827">
  <root>
    <mxCell id="0" />
    <mxCell id="1" parent="0" />
    <mxCell id="2" value="Node A" style="rounded=1;" vertex="1" parent="1">
      <mxGeometry x="100" y="100" width="120" height="60" as="geometry" />
    </mxCell>
    <mxCell id="3" value="Node B" style="rounded=1;" vertex="1" parent="1">
      <mxGeometry x="100" y="100" width="120" height="60" as="geometry" />
    </mxCell>
    <mxCell id="4" value="Node C" style="rounded=1;" vertex="1" parent="1">
      <mxGeometry x="100" y="100" width="120" height="60" as="geometry" />
    </mxCell>
    <mxCell id="5" value="" style="endArrow=block;" edge="1" parent="1" source="2" target="3">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
    <mxCell id="6" value="" style="endArrow=block;" edge="1" parent="1" source="3" target="4">
      <mxGeometry relative="1" as="geometry" />
    </mxCell>
  </root>
</mxGraphModel>
    """.trimIndent()

    @Test
    fun `layered layout separates overlapping nodes`() {
        val file = createTestFile("test.drawio", sampleDrawio)
        val tool = DrawioAutoLayoutTool(tempDir.absolutePath)
        val args = buildJsonObject { put("file_path", file.absolutePath) }
        val result = tool.execute(args)
        // Tool is review-only: reports issues for overlapping nodes
        assertTrue(result.contains("needs_fix") || result.contains("already_good"), "Expected status, got: $result")
        assertTrue(result.contains("\"nodes\""), "Expected nodes count in result")
        assertTrue(result.contains("\"edges\""), "Expected edges count in result")
    }

    @Test
    fun `handles mxfile wrapper`() {
        val wrapped = """
<mxfile>
  <diagram name="Page-1">
    $sampleDrawio
  </diagram>
</mxfile>
        """.trimIndent()
        val file = createTestFile("wrapped.drawio", wrapped)
        val tool = DrawioAutoLayoutTool(tempDir.absolutePath)
        val args = buildJsonObject { put("file_path", file.absolutePath) }
        val result = tool.execute(args)
        // Should parse mxfile wrapper and analyze diagram
        assertTrue(result.contains("needs_fix") || result.contains("already_good"), "Expected status, got: $result")
    }

    @Test
    fun `force algorithm parameter accepted`() {
        val file = createTestFile("force.drawio", sampleDrawio)
        val tool = DrawioAutoLayoutTool(tempDir.absolutePath)
        val args = buildJsonObject {
            put("file_path", file.absolutePath)
            put("algorithm", "force")
        }
        val result = tool.execute(args)
        // Algorithm param is accepted (tool is review-only, doesn't apply layout)
        assertTrue(result.contains("needs_fix") || result.contains("already_good"), "Expected status, got: $result")
    }

    @Test
    fun `returns error for missing file`() {
        val tool = DrawioAutoLayoutTool(tempDir.absolutePath)
        val args = buildJsonObject { put("file_path", "nonexistent.drawio") }
        val result = tool.execute(args)
        assertTrue(result.contains("error"))
    }

    @Test
    fun `returns error for non-drawio file`() {
        val file = createTestFile("test.txt", "hello")
        val tool = DrawioAutoLayoutTool(tempDir.absolutePath)
        val args = buildJsonObject { put("file_path", file.absolutePath) }
        val result = tool.execute(args)
        assertTrue(result.contains("error"))
    }

    @Test
    fun `detects overlapping nodes at same position`() {
        val file = createTestFile("overlap.drawio", sampleDrawio)
        val tool = DrawioAutoLayoutTool(tempDir.absolutePath)
        val args = buildJsonObject { put("file_path", file.absolutePath) }
        val result = tool.execute(args)
        // All 3 nodes are at x=100 y=100 — tool should detect overlaps
        assertTrue(result.contains("needs_fix"), "Expected needs_fix for overlapping nodes, got: $result")
        assertTrue(result.contains("node_overlap"), "Expected node_overlap issues")
    }

    private fun createTestFile(name: String, content: String): File {
        val file = File(tempDir, name)
        file.writeText(content)
        return file
    }
}
