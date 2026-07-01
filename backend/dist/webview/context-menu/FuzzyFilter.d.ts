/**
 * FuzzyFilter — Lightweight fuzzy matching for context menu items
 * KSA-252
 */
import type { FuzzyMatchResult } from './types';
export declare function fuzzyMatch(target: string, query: string): FuzzyMatchResult;
export declare function filterItems<T extends {
    label: string;
}>(items: T[], query: string): (T & {
    score: number;
    highlights: number[];
})[];
