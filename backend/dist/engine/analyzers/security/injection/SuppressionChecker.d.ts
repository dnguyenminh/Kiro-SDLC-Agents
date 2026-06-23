/**
 * KSA-165: Suppression Checker — Detects nosec/NOLINT markers to suppress findings.
 */
import type { SuppressionInfo } from '../types.js';
interface SuppressionMarker {
    pattern: string;
    scope: 'line' | 'block' | 'file';
}
export declare class SuppressionChecker {
    private markers;
    constructor(markers?: SuppressionMarker[]);
    /** Check if a specific line in source code has a suppression marker. */
    isSuppressed(sourceLines: string[], line: number): SuppressionInfo | null;
    /** Check if entire file is suppressed. */
    isFileSuppressed(sourceLines: string[]): boolean;
}
export {};
