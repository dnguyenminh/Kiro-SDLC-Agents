"use strict";
/**
 * KSA-161: Grade assignment based on cyclomatic complexity thresholds.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GradeAssigner = void 0;
const DEFAULT_THRESHOLDS = {
    A: 5,
    B: 10,
    C: 20,
    D: 50,
};
class GradeAssigner {
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
exports.GradeAssigner = GradeAssigner;
//# sourceMappingURL=GradeAssigner.js.map