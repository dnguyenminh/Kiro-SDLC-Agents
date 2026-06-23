/**
 * KSA-160: Budget Allocator — allocates token budget across ranked results.
 * Top results get full source, middle get signatures, bottom get references.
 */
import { MergedResult } from './types.js';
export interface AllocatedResult extends MergedResult {
    detail: 'full' | 'signature' | 'reference';
    content: string;
    tokens: number;
}
export declare class BudgetAllocator {
    private CHARS_PER_TOKEN;
    /** Allocate token budget across merged results with progressive detail levels. */
    allocate(results: MergedResult[], maxTokens: number): AllocatedResult[];
    private estimateTokens;
}
