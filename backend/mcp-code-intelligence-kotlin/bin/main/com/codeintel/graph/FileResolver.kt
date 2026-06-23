/** File Resolver — resolves import paths to indexed file paths. KSA-173. */
package com.codeintel.graph

import java.sql.Connection

class FileResolver(conn: Connection, private val workspaceRoot: String) {

    private var indexedFiles: Set<String> = loadIndexedFiles(conn)

    /** Resolve an input file path to a canonical indexed path. */
    fun resolveFile(input: String): String? {
        if (input in indexedFiles) return input

        val normalized = input.replace("\\", "/")
        if (normalized in indexedFiles) return normalized

        if (input.startsWith(workspaceRoot)) {
            val relative = input.removePrefix(workspaceRoot)
                .trimStart('/', '\\').replace("\\", "/")
            if (relative in indexedFiles) return relative
        }

        findWithExtensions(normalized)?.let { return it }

        val basename = normalized.substringAfterLast("/")
        val matches = indexedFiles.filter {
            it.endsWith(basename) || it.endsWith("/$basename")
        }
        if (matches.size == 1) return matches.first()

        return null
    }

    /** Resolve an import target relative to a source file. */
    fun resolveImportTarget(sourceFile: String, target: String): String? {
        if (target.startsWith(".")) {
            val dir = sourceFile.replace("\\", "/").substringBeforeLast("/", "")
            val resolved = normalizePath("$dir/$target")
            return findWithExtensions(resolved)
        }
        return findWithExtensions(target)
    }

    /** Check if a target is an external dependency. */
    fun isExternal(target: String): Boolean {
        val base = target.split("/").first().split(".").first()
        if (base in STDLIB_MODULES) return true
        if (!target.startsWith(".") && !target.startsWith("/")) {
            return resolveImportTarget("", target) == null
        }
        return false
    }

    /** Refresh indexed files after re-indexing. */
    fun refresh(conn: Connection) {
        indexedFiles = loadIndexedFiles(conn)
    }

    private fun findWithExtensions(basePath: String): String? {
        if (basePath in indexedFiles) return basePath
        for (ext in EXTENSIONS) {
            val candidate = basePath + ext
            if (candidate in indexedFiles) return candidate
        }
        return null
    }

    private fun normalizePath(path: String): String {
        val parts = path.split("/").toMutableList()
        val result = mutableListOf<String>()
        for (part in parts) {
            when (part) {
                ".", "" -> {}
                ".." -> if (result.isNotEmpty()) result.removeLast()
                else -> result.add(part)
            }
        }
        return result.joinToString("/")
    }

    companion object {
        private val EXTENSIONS = listOf(
            ".ts", ".js", ".tsx", ".jsx", ".kt", ".py", "/index.ts", "/index.js"
        )

        private val STDLIB_MODULES = setOf(
            "fs", "path", "http", "https", "url", "crypto", "os", "util",
            "stream", "events", "child_process", "cluster", "net", "dns",
            "tls", "readline", "zlib", "buffer", "assert", "querystring",
            "string_decoder", "timers", "vm", "worker_threads",
            "sys", "json", "re", "math", "datetime", "collections",
            "itertools", "functools", "typing", "pathlib", "abc",
            "dataclasses", "enum", "logging", "unittest", "io",
            "subprocess", "threading", "multiprocessing",
        )

        private fun loadIndexedFiles(conn: Connection): Set<String> {
            val stmt = conn.createStatement()
            val rs = stmt.executeQuery("SELECT relative_path FROM files")
            val files = mutableSetOf<String>()
            while (rs.next()) files.add(rs.getString(1))
            return files
        }
    }
}
