/** Impact Recommendations — generates actionable recommendations. KSA-173. */
package com.codeintel.graph

import com.codeintel.graph.models.ImpactAction
import com.codeintel.graph.models.ImpactItem
import com.codeintel.graph.models.Severity

object ImpactRecommendations {

    /** Generate recommendations based on impact analysis results. */
    fun generate(
        impacts: List<ImpactItem>,
        action: ImpactAction,
        symbol: String,
        testDetector: TestDetector,
    ): List<String> {
        val recs = mutableListOf<String>()
        val critical = impacts.filter { it.severity == Severity.CRITICAL }
        val testImpacts = impacts.filter { testDetector.isTestFile(it.file) }

        if (action == ImpactAction.DELETE && impacts.isEmpty()) {
            recs.add("Safe to delete \"$symbol\" - no references found")
        } else if (action == ImpactAction.DELETE && impacts.isNotEmpty()) {
            recs.add("Remove all ${impacts.size} references before deleting \"$symbol\"")
        }

        if (action == ImpactAction.MODIFY && critical.isNotEmpty()) {
            recs.add("Update ${critical.size} direct callers if signature changes")
        }

        if (action == ImpactAction.RENAME) {
            val files = impacts.map { it.file }.toSet().size
            recs.add("Update references in $files files with new name")
        }

        if (testImpacts.isNotEmpty()) {
            val testFiles = testImpacts.take(5).joinToString(", ") { it.file }
            recs.add("Run affected tests: $testFiles")
        }

        if (impacts.size > 20) {
            recs.add("Consider incremental refactoring to reduce blast radius")
        }

        return recs
    }
}
