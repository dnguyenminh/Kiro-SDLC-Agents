/**
 * KSA-162: Route Resolver — Resolves full routes from prefix + method path.
 */
package com.codeintel.analyzers.entrypoints

class RouteResolver {

    fun resolve(controllerPrefix: String?, methodPath: String): String {
        val prefix = normalizePath(controllerPrefix ?: "")
        val path = normalizePath(methodPath)
        if (prefix.isEmpty()) return path.ifEmpty { "/" }
        if (path.isEmpty() || path == "/") return prefix
        return "$prefix$path"
    }

    fun normalizeParams(path: String): String =
        path.replace(Regex("<(?:[a-z]+:)?([a-zA-Z_][a-zA-Z0-9_]*)>"), "{$1}")
            .replace(Regex(":([a-zA-Z_][a-zA-Z0-9_]*)"), "{$1}")

    fun extractPathFromArg(arg: String): String {
        val path = arg.trim().removeSurrounding("\"").removeSurrounding("'").removeSurrounding("`")
        return normalizeParams(path)
    }

    private fun normalizePath(path: String): String {
        if (path.isEmpty()) return ""
        var p = path
        if (!p.startsWith("/")) p = "/$p"
        if (p.length > 1 && p.endsWith("/")) p = p.dropLast(1)
        return p
    }
}
