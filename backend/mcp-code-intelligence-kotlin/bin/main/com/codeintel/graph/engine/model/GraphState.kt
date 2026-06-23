/** Graph lifecycle state. KSA-173. */
package com.codeintel.graph.engine.model

enum class GraphState {
    NOT_BUILT,
    BUILDING,
    READY,
    UPDATING,
    ERROR
}
