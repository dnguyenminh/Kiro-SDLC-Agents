/**
 * Port conflict bug fix tests — ViewerServer port release on shutdown.
 *
 * Bug: When MCP server is reconnected, old instance doesn't release the HTTP
 * viewer port, causing "port already in use" error.
 *
 * Fix: ViewerServer stores engine reference + stop() calls engine.stop()
 * McpServer.shutdown() calls viewerServer?.stop() on stdin close + shutdown hook.
 */
package com.codeintel.http

import com.codeintel.Config
import com.codeintel.DEFAULT_EXCLUDE
import com.codeintel.DEFAULT_EXTENSIONS
import java.net.ServerSocket
import java.net.Socket
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ViewerServerPortTest {

    private fun findFreePort(): Int {
        ServerSocket(0).use { return it.localPort }
    }

    private fun isPortInUse(port: Int): Boolean {
        return try {
            Socket("127.0.0.1", port).use { true }
        } catch (_: Exception) {
            false
        }
    }

    private fun createConfig(port: Int): Config {
        return Config(
            workspace = ".",
            dbPath = ":memory:",
            viewerPort = port,
            watchEnabled = false,
            watchDebounceMs = 500,
            ollamaUrl = null,
            ollamaModel = "nomic-embed-text",
            excludePatterns = DEFAULT_EXCLUDE,
            includeExtensions = DEFAULT_EXTENSIONS,
            maxFileSize = 512_000
        )
    }

    @Test
    fun `stop releases port`() {
        val port = findFreePort()
        val server = ViewerServer(createConfig(port))
        val thread = Thread { server.start() }
        thread.isDaemon = true
        thread.start()
        Thread.sleep(1500)

        assertTrue(isPortInUse(port), "Port $port should be bound after start()")

        server.stop()
        Thread.sleep(500)

        assertFalse(isPortInUse(port), "Port $port should be free after stop()")
    }

    @Test
    fun `reconnect same port succeeds`() {
        val port = findFreePort()

        // First instance
        val server1 = ViewerServer(createConfig(port))
        val t1 = Thread { server1.start() }
        t1.isDaemon = true
        t1.start()
        Thread.sleep(1500)
        assertTrue(isPortInUse(port))

        // Simulate stdin close → shutdown
        server1.stop()
        Thread.sleep(500)
        assertFalse(isPortInUse(port))

        // Second instance on same port — should succeed
        val server2 = ViewerServer(createConfig(port))
        val t2 = Thread { server2.start() }
        t2.isDaemon = true
        t2.start()
        Thread.sleep(1500)
        assertTrue(isPortInUse(port), "Second instance should bind same port")

        // Cleanup
        server2.stop()
        Thread.sleep(500)
        assertFalse(isPortInUse(port))
    }

    @Test
    fun `stop is idempotent`() {
        val port = findFreePort()
        val server = ViewerServer(createConfig(port))
        val thread = Thread { server.start() }
        thread.isDaemon = true
        thread.start()
        Thread.sleep(1500)

        // Multiple stops should not throw
        server.stop()
        server.stop()
        server.stop()
    }

    @Test
    fun `stop without start does not throw`() {
        val port = findFreePort()
        val server = ViewerServer(createConfig(port))
        // Should not throw — engine is null
        server.stop()
    }
}
