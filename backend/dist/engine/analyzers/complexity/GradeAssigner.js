/**
 * KSA-161: Grade assignment based on cyclomatic complexity thresholds.
 */
const DEFAULT_THRESHOLDS = {
    A: 5,
    B: 10,
    C: 20,
    D: 50,
};
export class GradeAssigner {
    thresholds;
    constructor(thresholds) {
        this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    }
    /** Assign a letter grade based on cyclomatic complexity score. */
    assignGrade(cc) {
        if (cc <= this.thresholds.A)
            return 'A';
        if (cc <= this.thresholds.B)
            return 'B';
        if (cc <= this.thresholds.C)
            return 'C';
        if (cc <= this.thresholds.D)
            return 'D';
        return 'F';
    }
    /** Get the current thresholds. */
    getThresholds() {
        return { ...this.thresholds };
    }
}
//# sourceMappingURL=GradeAssigner.js.map