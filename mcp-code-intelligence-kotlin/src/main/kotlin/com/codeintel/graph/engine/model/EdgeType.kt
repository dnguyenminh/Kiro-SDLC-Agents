/** Edge type enum for graph engine. KSA-173. */
package com.codeintel.graph.engine.model

enum class EdgeType {
    CALL,
    STATIC_IMPORT,
    DYNAMIC_IMPORT,
    RE_EXPORT,
    TYPE_ONLY,
    EXTENDS,
    IMPLEMENTS,
    UNRESOLVED
}
