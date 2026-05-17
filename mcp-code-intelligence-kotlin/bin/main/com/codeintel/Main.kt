/**
 * Entry point — starts MCP server + HTTP viewer.
 * Passes CLI args to Config for --workspace and --viewer-port resolution.
 * Viewer starts immediately; memory engine wired after MCP initialize.
 */
package com.codeintel

import com.codeintel.http.ViewerServer

/** Shared viewer server — memory engine attached after MCP initialize. */
var viewerServer: ViewerServer? = null
    private set

fun main(args: Array<String>) {
    Config.setCliArgs(args)
    viewerServer = startViewerThread()
    val server = McpServer(args)
    server.run()
}

private fun startViewerThread(): ViewerServer? {
    val port = Config.resolveViewerPort()
    if (port <= 0) return null
    val config = Config.load()
    val viewer = ViewerServer(config)
    Thread {
        try {
            viewer.start()
        } catch (e: Exception) {
            log("HTTP viewer failed: ${e.message}")
        }
    }.apply { isDaemon = true; name = "viewer-http"; start() }
    return viewer
}

/** Log to stderr so stdout stays clean for JSON-RPC. */
fun log(msg: String) {
    System.err.println("[code-intel] $msg")
    System.err.flush()
}
