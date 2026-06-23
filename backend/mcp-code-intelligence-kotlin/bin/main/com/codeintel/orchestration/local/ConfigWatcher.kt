/**
 * Config hot-reload watcher — uses Java WatchService to detect changes to the
 * orchestration config file and triggers reload on modification.
 */
package com.codeintel.orchestration.local

import com.codeintel.log
import com.codeintel.orchestration.OrchestrationConfig
import java.nio.file.*

class ConfigWatcher(
    private val configPath: String,
    private val onReload: (OrchestrationConfig) -> Unit
) {
    @Volatile private var running = false
    private var watchThread: Thread? = null

    /** Start watching the config file for changes in a daemon thread. */
    fun start() {
        if (running) return
        running = true
        watchThread = Thread { watchLoop() }.apply {
            isDaemon = true
            name = "config-watcher"
            start()
        }
        log("ConfigWatcher started for: $configPath")
    }

    /** Stop watching. */
    fun stop() {
        running = false
        watchThread?.interrupt()
        watchThread = null
        log("ConfigWatcher stopped")
    }

    private fun watchLoop() {
        val path = Paths.get(configPath)
        val dir = path.parent ?: return
        val fileName = path.fileName.toString()
        try {
            val watcher = FileSystems.getDefault().newWatchService()
            dir.register(watcher, StandardWatchEventKinds.ENTRY_MODIFY)
            pollEvents(watcher, fileName)
        } catch (e: InterruptedException) {
            // Normal shutdown
        } catch (e: Exception) {
            log("ConfigWatcher error: ${e.message}")
        }
    }

    private fun pollEvents(watcher: WatchService, fileName: String) {
        while (running) {
            val key = watcher.take()
            for (event in key.pollEvents()) {
                val changed = event.context() as? Path ?: continue
                if (changed.toString() == fileName) handleChange()
            }
            if (!key.reset()) break
        }
    }

    private fun handleChange() {
        log("Config file changed, reloading...")
        val config = OrchestrationConfig.load(configPath)
        if (config != null) {
            onReload(config)
            log("Config reloaded: ${config.enabledServers().size} servers")
        } else {
            log("Config reload failed — keeping current config")
        }
    }
}
