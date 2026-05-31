/** Configuration for auto-linking strategies. KSA-190. */
package com.codeintel.memory.ingest.autolink

import kotlinx.serialization.Serializable

@Serializable
data class SemanticConfig(
    val enabled: Boolean = true,
    val minScore: Double = 0.75,
    val maxEdges: Int = 5
)

@Serializable
data class EntityConfig(
    val enabled: Boolean = true,
    val minJaccard: Double = 0.3,
    val maxEdges: Int = 5
)

@Serializable
data class TagConfig(
    val enabled: Boolean = true,
    val minOverlap: Int = 2,
    val maxEdges: Int = 3
)

@Serializable
data class FtsConfig(
    val enabled: Boolean = true,
    val maxEdges: Int = 3,
    val fallbackThreshold: Int = 2
)

@Serializable
data class AutoLinkConfig(
    val enabled: Boolean = true,
    val semantic: SemanticConfig = SemanticConfig(),
    val entity: EntityConfig = EntityConfig(),
    val tag: TagConfig = TagConfig(),
    val fts: FtsConfig = FtsConfig(),
    val totalMaxEdges: Int = 10
)

/** Default configuration factory. */
fun defaultAutoLinkConfig(): AutoLinkConfig = AutoLinkConfig()
