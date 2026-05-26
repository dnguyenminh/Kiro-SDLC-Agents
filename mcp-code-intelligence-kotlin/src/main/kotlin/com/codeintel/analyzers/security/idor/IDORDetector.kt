/**
 * KSA-166: IDOR Detector — Detects Insecure Direct Object Reference vulnerabilities.
 */
package com.codeintel.analyzers.security.idor

import com.codeintel.analyzers.security.*
import com.codeintel.analyzers.security.taint.TaintAnalyzer
import com.codeintel.parsers.SyntaxNode

private val ID_PARAM_PATTERNS = listOf(
    Regex("id$", RegexOption.IGNORE_CASE), Regex("Id$"), Regex("_id$", RegexOption.IGNORE_CASE),
    Regex("Id\\b"), Regex("uuid", RegexOption.IGNORE_CASE), Regex("key$", RegexOption.IGNORE_CASE),
    Regex("slug", RegexOption.IGNORE_CASE), Regex("params\\.id"), Regex("params\\.\\w+Id"), Regex("params\\.\\w+_id")
)

private val DB_LOOKUP_PATTERNS = listOf(
    "findById(", "findOne(", "findByPk(", "get(", ".find(",
    "findUnique(", "findFirst(", "getOne(", "load(",
    "SELECT", "WHERE", "query("
)

private val AUTHZ_PATTERNS = listOf(
    "owner", "user_id", "userId", "createdBy", "belongsTo",
    "canAccess", "isOwner", "hasPermission", "authorize",
    "checkAccess", "verifyOwnership", "req.user.id",
    "currentUser", "session.user"
)

class IDORDetector(taintAnalyzer: TaintAnalyzer? = null) {
    private val taintAnalyzer = taintAnalyzer ?: TaintAnalyzer()

    fun detect(functionNode: SyntaxNode, filePath: String, language: String, handlerName: String): List<IDORFinding> {
        val findings = mutableListOf<IDORFinding>()
        val bodyText = functionNode.text

        val idParams = findIDParams(bodyText)
        if (idParams.isEmpty()) return emptyList()

        for (param in idParams) {
            val dbLookup = findDBLookup(bodyText, param) ?: continue
            val hasAuthz = hasAuthorizationCheck(bodyText)

            if (!hasAuthz) {
                val trustTier = classifyTrustTier(bodyText, param)
                findings.add(IDORFinding(
                    handler = handlerName, filePath = filePath, idParam = param,
                    dbLookup = dbLookup, missingAuthzCheck = true,
                    trustTier = trustTier,
                    confidence = when (trustTier) { TrustTier.T1 -> 90; TrustTier.T2 -> 70; else -> 50 },
                    cwe = "CWE-639",
                    severity = if (trustTier == TrustTier.T1) Severity.HIGH else Severity.MEDIUM
                ))
            }
        }
        return findings
    }

    private fun findIDParams(text: String): List<String> {
        val params = mutableListOf<String>()
        for (pattern in ID_PARAM_PATTERNS) {
            for (match in pattern.findAll(text)) {
                if (match.value !in params) params.add(match.value)
            }
        }
        return params
    }

    private fun findDBLookup(bodyText: String, param: String): Map<String, Any>? {
        for (pattern in DB_LOOKUP_PATTERNS) {
            val idx = bodyText.indexOf(pattern)
            if (idx != -1) {
                val context = bodyText.substring(maxOf(0, idx - 50), minOf(bodyText.length, idx + 100))
                if (param in context) {
                    val line = bodyText.substring(0, idx).count { it == '\n' } + 1
                    return mapOf("function" to pattern.trimEnd('('), "line" to line)
                }
            }
        }
        return null
    }

    private fun hasAuthorizationCheck(bodyText: String) = AUTHZ_PATTERNS.any { it in bodyText }

    private fun classifyTrustTier(bodyText: String, param: String): TrustTier {
        val lines = bodyText.split("\n")
        var paramLine = -1
        var lookupLine = -1

        for ((i, line) in lines.withIndex()) {
            if (param in line && paramLine == -1) paramLine = i
            if (DB_LOOKUP_PATTERNS.any { it in line }) lookupLine = i
        }

        if (paramLine >= 0 && lookupLine >= 0) {
            val distance = kotlin.math.abs(lookupLine - paramLine)
            if (distance <= 2) return TrustTier.T1
            if (distance <= 5) return TrustTier.T2
        }
        return TrustTier.T3
    }
}
