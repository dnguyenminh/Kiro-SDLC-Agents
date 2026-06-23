package com.fec.memory

import com.fec.memory.config.AppConfig
import com.fec.memory.transport.McpServer
import com.fec.memory.transport.HttpServer
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import mu.KotlinLogging

private val logger = KotlinLogging.logger {}

/**
 * Entry point for SDLC Memory MCP Server.
 * Starts dual transport: stdio (MCP) + HTTP (Web Viewer).
 */
fun main(args: Array<String>) = runBlocking {
    val config = AppConfig.fromArgs(args)
    logger.info { "SDLC Memory starting..." }
    logger.info { "Workspace: ${config.workspace}" }
    logger.info { "Viewer port: ${config.viewerPort}" }

    val mcpServer = McpServer(config)
    val httpServer = HttpServer(config)

    launch { httpServer.start() }
    mcpServer.run()
}
