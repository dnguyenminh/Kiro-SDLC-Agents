/**
 * KSA-164: CFG Edge — Represents control flow between basic blocks.
 */
import type { EdgeType } from '../types.js';
import type { BasicBlock } from './BasicBlock.js';
export declare class CFGEdge {
    readonly from: BasicBlock;
    readonly to: BasicBlock;
    readonly type: EdgeType;
    readonly label?: string;
    constructor(from: BasicBlock, to: BasicBlock, type: EdgeType, label?: string);
    toString(): string;
}
