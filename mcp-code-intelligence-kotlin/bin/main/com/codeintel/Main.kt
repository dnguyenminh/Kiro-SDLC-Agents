/**
 * Entry point — starts MCP server.
 * Passes CLI args to Config for --workspace resolution.
 */
package com.codeintel

fun main(args: Array<String>) {
    val server = McpServer(args)
    server.run()
}

/** Log to stderr so stdout stays clean for JSON-RPC. */
fun log(msg: String) {
    System.err.println("[code-intel] $msg")
    System.err.flush()
}
