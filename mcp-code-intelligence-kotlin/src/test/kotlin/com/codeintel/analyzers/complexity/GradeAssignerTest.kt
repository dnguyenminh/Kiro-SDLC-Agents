package com.codeintel.analyzers.complexity

import kotlin.test.Test
import kotlin.test.assertEquals

class GradeAssignerTest {
    private val grader = GradeAssigner()

    @Test fun `grade A for low complexity`() {
        assertEquals(Grade.A, grader.assignGrade(1))
        assertEquals(Grade.A, grader.assignGrade(5))
    }

    @Test fun `grade B for moderate complexity`() {
        assertEquals(Grade.B, grader.assignGrade(6))
        assertEquals(Grade.B, grader.assignGrade(10))
    }

    @Test fun `grade C for high complexity`() {
        assertEquals(Grade.C, grader.assignGrade(11))
        assertEquals(Grade.C, grader.assignGrade(20))
    }

    @Test fun `grade D for very high complexity`() {
        assertEquals(Grade.D, grader.assignGrade(21))
        assertEquals(Grade.D, grader.assignGrade(50))
    }

    @Test fun `grade F for extreme complexity`() {
        assertEquals(Grade.F, grader.assignGrade(51))
        assertEquals(Grade.F, grader.assignGrade(100))
    }

    @Test fun `custom thresholds`() {
        val custom = GradeAssigner(GradeThresholds(a = 3, b = 6, c = 10, d = 20))
        assertEquals(Grade.A, custom.assignGrade(3))
        assertEquals(Grade.B, custom.assignGrade(4))
        assertEquals(Grade.F, custom.assignGrade(21))
    }
}
