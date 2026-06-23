/**
 * KSA-161: Grade assignment based on cyclomatic complexity thresholds.
 */
import type { Grade, GradeThresholds } from './types.js';
export declare class GradeAssigner {
    private thresholds;
    constructor(thresholds?: Partial<GradeThresholds>);
    /** Assign a letter grade based on cyclomatic complexity score. */
    assignGrade(cc: number): Grade;
    /** Get the current thresholds. */
    getThresholds(): GradeThresholds;
}
