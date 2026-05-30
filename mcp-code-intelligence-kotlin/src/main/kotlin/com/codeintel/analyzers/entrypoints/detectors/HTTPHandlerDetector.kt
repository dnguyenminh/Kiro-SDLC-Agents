/**
 * KSA-162: HTTP Handler Detector — Detects HTTP route handlers.
 */
package com.codeintel.analyzers.entrypoints.detectors

import com.codeintel.analyzers.entrypoints.*

class HTTPHandlerDetector(private val registry: PatternRegistry) {
    private val routeResolver = RouteResolver()

    fun detectFromSymbols(symbols: List<SymbolInput>, framework: String, source: String): List<EntryPoint> {
        val patterns = registry.getFramework(framework) ?: return emptyList()
        val controllerPrefix = findControllerPrefix(symbols, patterns)
        return symbols.mapNotNull { detectHandler(it, framework, patterns, controllerPrefix, source) }
    }

    private fun detectHandler(
        sym: SymbolInput, framework: String, patterns: FrameworkPatterns,
        controllerPrefix: String?, source: String,
    ): EntryPoint? {
        val decorators = sym.decorators ?: emptyList()
        // Decorator-based (NestJS, Spring, FastAPI)
        patterns.decorators?.let { dec ->
            for (handlerPattern in dec.handler) {
                val match = decorators.find { it.contains(handlerPattern) }
                if (match != null) {
                    val (method, path) = extractMethodAndPath(match, handlerPattern)
                    val fullRoute = routeResolver.resolve(controllerPrefix, path)
                    val hasAuth = hasAuthIndicator(decorators, patterns)
                    return EntryPoint(
                        symbolId = sym.id, symbolName = sym.name,
                        filePath = sym.filePath, startLine = sym.startLine,
                        entryType = EntryType.HTTP_HANDLER, framework = framework,
                        httpMethod = method, routePath = path,
                        fullRoute = routeResolver.normalizeParams(fullRoute),
                        middleware = detectMiddleware(decorators),
                        hasAuth = hasAuth, controller = sym.parentName,
                        confidence = Confidence.High,
                    )
                }
            }
        }
        // Call-pattern-based (Express, Ktor, Gin)
        patterns.callPatterns?.let { cp ->
            val ctx = getSymbolContext(source, sym.startLine)
            for (handlerPattern in cp.handler) {
                if (ctx.contains(handlerPattern)) {
                    val method = extractMethodFromCall(handlerPattern)
                    val path = extractPathFromContext(ctx, handlerPattern)
                    val fullRoute = routeResolver.resolve(controllerPrefix, path)
                    return EntryPoint(
                        symbolId = sym.id, symbolName = sym.name,
                        filePath = sym.filePath, startLine = sym.startLine,
                        entryType = EntryType.HTTP_HANDLER, framework = framework,
                        httpMethod = method, routePath = path,
                        fullRoute = routeResolver.normalizeParams(fullRoute),
                        hasAuth = false, confidence = Confidence.Medium,
                    )
                }
            }
        }
        return null
    }

    private fun findControllerPrefix(symbols: List<SymbolInput>, patterns: FrameworkPatterns): String? {
        val prefixes = patterns.decorators?.prefix ?: return null
        for (prefix in prefixes) {
            for (sym in symbols) {
                val match = sym.decorators?.find { it.contains(prefix) }
                if (match != null) return extractPathArg(match)
            }
        }
        return null
    }

    private fun extractMethodAndPath(decorator: String, pattern: String): Pair<String, String> {
        val lower = pattern.lowercase()
        val method = when {
            "post" in lower -> "POST"; "put" in lower -> "PUT"
            "delete" in lower -> "DELETE"; "patch" in lower -> "PATCH"
            else -> "GET"
        }
        return method to extractPathArg(decorator)
    }

    private fun extractPathArg(text: String): String {
        val match = Regex("['\"`]([^'\"`]*)['\"`]").find(text)
        return if (match != null) routeResolver.extractPathFromArg(match.groupValues[1]) else "/"
    }

    private fun extractMethodFromCall(pattern: String): String {
        val p = pattern.lowercase()
        return when {
            "post" in p -> "POST"; "put" in p -> "PUT"
            "delete" in p -> "DELETE"; "patch" in p -> "PATCH"
            else -> "GET"
        }
    }

    private fun extractPathFromContext(context: String, pattern: String): String {
        val idx = context.indexOf(pattern)
        if (idx == -1) return "/"
        val after = context.substring(idx + pattern.length)
        val match = Regex("['\"`]([^'\"`]*)['\"`]").find(after)
        return if (match != null) routeResolver.extractPathFromArg(match.groupValues[1]) else "/"
    }

    private fun getSymbolContext(source: String, startLine: Int): String {
        val lines = source.split("\n")
        val start = maxOf(0, startLine - 3)
        val end = minOf(lines.size, startLine + 5)
        return lines.subList(start, end).joinToString("\n")
    }

    private fun detectMiddleware(decorators: List<String>): List<String> =
        decorators.filter { "UseGuards" in it || "Middleware" in it }

    private fun hasAuthIndicator(decorators: List<String>, patterns: FrameworkPatterns): Boolean =
        patterns.authIndicators.any { indicator -> decorators.any { it.contains(indicator) } }
}
