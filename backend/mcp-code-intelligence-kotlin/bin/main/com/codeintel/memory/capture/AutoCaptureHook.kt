/** Auto-capture hooks — automatically captures knowledge from agent interactions. */
package com.codeintel.memory.capture

import com.codeintel.memory.decision.DecisionMemory
import com.codeintel.memory.decision.ErrorPattern
import com.codeintel.memory.decision.ErrorPatternMemory
import com.codeintel.memory.decision.Decision
import com.codeintel.memory.ingest.IngestPipeline

/** Types of events that can be auto-captured. */
enum class CaptureEvent {
    TOOL_CALL, DECISION_MADE, ERROR_OCCURRED, DOCUMENT_CREATED, HANDOFF
}

/** Configuration for auto-capture behavior. */
data class CaptureConfig(
    val enabled: Boolean = true,
    val captureToolCalls: Boolean = true,
    val captureDecisions: Boolean = true,
    val captureErrors: Boolean = true,
    val captureDocuments: Boolean = true,
    val minContentLength: Int = 50
)

class AutoCaptureHook(
    private val pipeline: IngestPipeline,
    private val decisionMemory: DecisionMemory,
    private val errorMemory: ErrorPatternMemory,
    private val config: CaptureConfig = CaptureConfig()
) {

    /** Capture a tool call result as knowledge. */
    fun captureToolResult(toolName: String, result: String, source: String?) {
        if (!config.captureToolCalls) return
        if (result.length < config.minContentLength) return
        pipeline.ingestEntry(
            content = result,
            summary = "Tool result: $toolName",
            type = "CONTEXT",
            source = source,
            tags = "auto-capture,tool,$toolName"
        )
    }

    /** Capture a decision. */
    fun captureDecision(title: String, context: String, decision: String, rationale: String, source: String?) {
        if (!config.captureDecisions) return
        decisionMemory.recordDecision(Decision(
            title = title, context = context,
            decision = decision, rationale = rationale,
            source = source, tags = "auto-capture"
        ))
    }

    /** Capture an error pattern. */
    fun captureError(error: String, context: String, solution: String, source: String?) {
        if (!config.captureErrors) return
        errorMemory.recordError(ErrorPattern(
            errorMessage = error, context = context,
            rootCause = "Auto-detected", solution = solution,
            source = source, tags = "auto-capture"
        ))
    }

    /** Capture a document. */
    fun captureDocument(content: String, source: String, format: String = "markdown") {
        if (!config.captureDocuments) return
        if (content.length < config.minContentLength) return
        when (format) {
            "markdown" -> pipeline.ingestMarkdown(content, source)
            else -> pipeline.ingestText(content, source)
        }
    }
}
