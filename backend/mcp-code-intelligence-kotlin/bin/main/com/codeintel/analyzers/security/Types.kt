/**
 * KSA-164/165/166/167: Security Analysis — Shared type definitions.
 * Ported from mcp-code-intelligence-nodejs.
 */
package com.codeintel.analyzers.security

import com.codeintel.parsers.SyntaxNode

// ─── CFG Types ──────────────────────────────────────────────────────────────

enum class BlockType { ENTRY, EXIT, NORMAL, BRANCH, LOOP_HEADER, CATCH }

enum class EdgeType {
    SEQUENTIAL, BRANCH_TRUE, BRANCH_FALSE,
    LOOP_BACK, LOOP_EXIT, EXCEPTION, RETURN
}

data class Statement(
    val node: SyntaxNode,
    val line: Int,
    val type: String,
    val text: String
)

data class VariableDef(
    val name: String,
    val line: Int,
    val blockId: Int,
    val node: SyntaxNode
)

data class VariableUse(
    val name: String,
    val line: Int,
    val blockId: Int,
    val node: SyntaxNode
)

// ─── Data Flow Types ────────────────────────────────────────────────────────

data class Definition(
    val variable: String,
    val line: Int,
    val blockId: Int,
    val id: Int
)

data class DefUseChain(
    val definition: Definition,
    val uses: List<Map<String, Int>> // [{line, blockId}]
)

data class DataFlowResult(
    val reachingDefs: Map<Int, Set<Definition>>,
    val defUseChains: List<DefUseChain>,
    val definitions: List<Definition>
)

// ─── Taint Types ────────────────────────────────────────────────────────────

enum class TaintSourceType {
    HTTP_PARAM, HTTP_BODY, HTTP_HEADER, HTTP_COOKIE,
    URL_PARAM, FILE_READ, ENV_VAR, DB_RESULT,
    USER_INPUT, CLI_ARG, WEBSOCKET
}

enum class TaintSinkType {
    SQL_QUERY, SHELL_EXEC, FILE_WRITE, FILE_PATH,
    HTML_OUTPUT, EVAL, DESERIALIZE, LDAP_QUERY,
    XML_PARSE, URL_FETCH, REDIRECT, LOG_OUTPUT
}

enum class TaintStepAction {
    ASSIGN, CONCAT, TEMPLATE_LITERAL, FORMAT_STRING,
    FUNCTION_CALL, COLLECTION_ADD, DESTRUCTURE, SANITIZE, PASS_THROUGH
}

data class TaintSource(
    val variable: String,
    val type: TaintSourceType,
    val line: Int,
    val expression: String
)

data class TaintSink(
    val function: String,
    val type: TaintSinkType,
    val line: Int,
    val expression: String,
    val paramIndex: Int
)

data class TaintStep(
    val variable: String,
    val line: Int,
    val action: TaintStepAction,
    val expression: String
)

data class TaintPath(
    val source: TaintSource,
    val sink: TaintSink,
    val chain: List<TaintStep>,
    val sanitized: Boolean,
    val length: Int
)

data class TaintResult(
    val paths: List<TaintPath>,
    val sources: List<TaintSource>,
    val sinks: List<TaintSink>,
    val sanitizers: List<Map<String, Any>>
)

data class TaintOptions(
    val maxPathLength: Int = 20,
    val includeSanitized: Boolean = false,
    val sinkTypes: List<TaintSinkType>? = null,
    val sourceTypes: List<TaintSourceType>? = null
)

// ─── Injection Types ────────────────────────────────────────────────────────

enum class Severity { CRITICAL, HIGH, MEDIUM, LOW, INFO }
enum class Confidence { HIGH, MEDIUM, LOW }

data class InjectionPattern(
    val id: Int,
    val name: String,
    val category: String,
    val cwe: String,
    val severity: Severity,
    val sinkPatterns: List<String>,
    val dangerousOps: List<String>,
    val safePatterns: List<String>,
    val description: String
)

data class Finding(
    val id: String,
    val ruleId: String,
    val category: String,
    val pattern: InjectionPattern,
    val taintPath: TaintPath,
    val severity: Severity,
    val confidence: Confidence,
    val cwe: String,
    val message: String,
    val remediation: String,
    val location: Map<String, Any>,
    var suppressed: Boolean = false,
    var suppressionInfo: SuppressionInfo? = null
)

data class SuppressionInfo(
    val marker: String,
    val scope: String, // "line" | "block" | "file"
    val line: Int
)

data class ScanOptions(
    val filePath: String? = null,
    val includeSuppressed: Boolean = false,
    val severityThreshold: Severity? = null,
    val categories: List<String>? = null,
    val outputFormat: String = "json"
)

data class ScanResult(
    val findings: List<Finding>,
    val suppressed: List<Finding>,
    val summary: Map<String, Any>
)

// ─── SSRF/IDOR Types ────────────────────────────────────────────────────────

enum class TrustTier { T1, T2, T3 }

data class SSRFFinding(
    val handler: String,
    val filePath: String,
    val source: TaintSource,
    val sink: TaintSink,
    val path: List<Int>,
    val trustTier: TrustTier,
    val confidence: Int,
    val missingControl: String,
    val cwe: String,
    val severity: Severity
)

data class IDORFinding(
    val handler: String,
    val filePath: String,
    val idParam: String,
    val dbLookup: Map<String, Any>,
    val missingAuthzCheck: Boolean,
    val trustTier: TrustTier,
    val confidence: Int,
    val cwe: String,
    val severity: Severity
)
