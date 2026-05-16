/** File watcher — NIO WatchService for incremental indexing. */
package com.codeintel.indexer

import com.codeintel.Config
import com.codeintel.log
import com.codeintel.scanner.detectLanguage
import kotlinx.coroutines.delay
import java.nio.file.*
import java.nio.file.attribute.BasicFileAttributes

class FileWatcher(private val config: Config, private val indexer: IndexingEngine) {

    /** Watch workspace for file changes and trigger incremental indexing. */
    suspend fun watch() {
        val watcher = FileSystems.getDefault().newWatchService()
        val workspace = Paths.get(config.workspace)
        registerRecursive(workspace, watcher)
        log("File watcher started")

        while (true) {
            val key = watcher.poll()
            if (key == null) {
                delay(config.watchDebounceMs)
            } else {
                processEvents(key, workspace)
                key.reset()
                delay(config.watchDebounceMs)
            }
        }
    }

    private fun processEvents(key: WatchKey, workspace: Path) {
        for (event in key.pollEvents()) {
            val kind = event.kind()
            if (kind == StandardWatchEventKinds.OVERFLOW) continue
            val path = (key.watchable() as Path).resolve(event.context() as Path)
            handleEvent(kind, path, workspace)
        }
    }

    private fun handleEvent(kind: WatchEvent.Kind<*>, path: Path, workspace: Path) {
        val rel = workspace.relativize(path).toString().replace("\\", "/")
        if (shouldIgnore(rel)) return

        when (kind) {
            StandardWatchEventKinds.ENTRY_CREATE,
            StandardWatchEventKinds.ENTRY_MODIFY -> {
                if (Files.isRegularFile(path) && detectLanguage(path.toString()) != null) {
                    log("Changed: $rel")
                    indexer.indexSingleFile(path.toString())
                }
            }
            StandardWatchEventKinds.ENTRY_DELETE -> {
                log("Deleted: $rel")
                indexer.removeFile(rel)
            }
        }
    }

    private fun shouldIgnore(relPath: String): Boolean {
        return config.excludePatterns.any { it in relPath }
    }

    private fun registerRecursive(root: Path, watcher: WatchService) {
        Files.walkFileTree(root, object : SimpleFileVisitor<Path>() {
            override fun preVisitDirectory(dir: Path, attrs: BasicFileAttributes): FileVisitResult {
                val name = dir.fileName?.toString() ?: ""
                if (name.startsWith(".") || name in config.excludePatterns) {
                    return FileVisitResult.SKIP_SUBTREE
                }
                dir.register(watcher,
                    StandardWatchEventKinds.ENTRY_CREATE,
                    StandardWatchEventKinds.ENTRY_MODIFY,
                    StandardWatchEventKinds.ENTRY_DELETE
                )
                return FileVisitResult.CONTINUE
            }
        })
    }
}
