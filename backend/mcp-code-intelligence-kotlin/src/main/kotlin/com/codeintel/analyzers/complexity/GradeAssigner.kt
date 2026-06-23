/**
 * KSA-161: Grade assignment based on cyclomatic complexity thresholds.
 */
package com.codeintel.analyzers.complexity

class GradeAssigner(thresholds: GradeThresholds? = null) {
    private val thresholds: GradeThresholds = thresholds ?: GradeThresholds()

    fun assignGrade(cc: Int): Grade = when {
        cc <= thresholds.a -> Grade.A
        cc <= thresholds.b -> Grade.B
        cc <= thresholds.c -> Grade.C
        cc <= thresholds.d -> Grade.D
        else -> Grade.F
    }

    fun getThresholds(): GradeThresholds = thresholds.copy()
}
