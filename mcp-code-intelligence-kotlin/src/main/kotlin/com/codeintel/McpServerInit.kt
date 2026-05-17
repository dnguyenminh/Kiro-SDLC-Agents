/**
 * MCP server initialization helpers — database, memory, indexing, orchestration setup.
 * Extracted from McpServer to keep file sizes under 200 lines.
 */
package com.codeintel

import com.codeintel.db.DatabaseManager
import com.codeintel.indexer.IndexingEngine
import com.codeintel.indexer.FileWatcher
import com.codeintel.memory.MemoryEngine
import com.codeintel.memory.embedding.EmbeddingFactory
import com.codeintel.memory.embedding.EmbeddingService
import com.codeintel.memory.graph.KnowledgeGraph
import com.codeintel.memory.tools.MemoryToolDispatcher
import com.codeintel.orchestration.OrchestrationConfig
import com.codeintel.orchestration.OrchestrationEngine
import com.codeintel.query.QueryLayer
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking

/** Result of full server initialization. */
data class InitResult(
    val db: DatabaseManager,
    val memoryEngine: MemoryEngine,
    val memoryDispatcher: MemoryToolDispatcher,
    val queryLayer: QueryLayer,
    val indexer: IndexingEngine,
    val orchestrationEngine: OrchestrationEngine?
)

/** Initialize all server subsystems. Returns InitResult or throws. */
fun initializeServer(config: Config): InitResult {
    val db = initDatabase(config)
    val (memory, dispatcher, ql) = initMemory(db, config)
    val indexer = initIndexing(db, config)
    val orch = initOrchestration(memory, config)
    return InitResult(db, memory, dispatcher, ql, indexer, orch)
}

private fun initDatabase(config: Config): DatabaseManager {
    val database = DatabaseManager(config.dbPath)
    database.initialize()
    return database
}

private data class MemoryResult(
    val engine: MemoryEngine,
    val dispatcher: MemoryToolDispatcher,
    val queryLayer: QueryLayer
)

private fun initMemory(db: DatabaseManager, config: Config): MemoryResult {
    val memory = MemoryEngine(db)
    memory.initialize()
    val knowledgeGraph = KnowledgeGraph(memory.graph)
    knowledgeGraph.loadFromDb()
    val embeddingService = EmbeddingFactory.create(config, memory.vectors)
    logEmbeddingStatus(embeddingService, config)
    val queryLayer = QueryLayer(db)
    val dispatcher = MemoryToolDispatcher(memory, embeddingService, knowledgeGraph, config.workspace, queryLayer)
    memory.startSession("mcp-client")
    wireViewer(memory, knowledgeGraph, embeddingService)
    return MemoryResult(memory, dispatcher, queryLayer)
}

private fun logEmbeddingStatus(service: EmbeddingService?, config: Config) {
    if (service != null) {
        log("✅ EmbeddingService initialized via Ollama (${config.ollamaModel})")
    } else {
        log("⚠️ EmbeddingService not available — vector search disabled, using BM25 only")
    }
}

private fun wireViewer(memory: MemoryEngine, graph: KnowledgeGraph, embedding: EmbeddingService?) {
    viewerServer?.memoryEngine = memory
    viewerServer?.knowledgeGraph = graph
    viewerServer?.embeddingService = embedding
}

private fun initIndexing(db: DatabaseManager, config: Config): IndexingEngine {
    val engine = IndexingEngine(db, config)
    Thread {
        runBlocking {
            launch { engine.runFullIndex() }
            if (config.watchEnabled) launch { FileWatcher(config, engine).watch() }
        }
    }.apply { isDaemon = true; start() }
    return engine
}

private fun initOrchestration(memory: MemoryEngine, config: Config): OrchestrationEngine? {
    val configPath = Config.orchestrationConfigPath ?: return null
    if (Config.currentDepth >= Config.maxRecursionDepth) {
        log("Max recursion depth — orchestration disabled")
        return null
    }
    val orchConfig = OrchestrationConfig.load(configPath) ?: return null
    val engine = OrchestrationEngine(orchConfig, memory, config)
    runBlocking { engine.start() }
    log("Orchestration enabled: ${orchConfig.enabledServers().size} servers configured")
    return engine
}
