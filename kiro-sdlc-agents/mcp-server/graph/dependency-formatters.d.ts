/**
 * KSA-155: Dependency Formatters - tree/flat/graph output formats.
 */
import { DependencyResult } from './dependency-graph-service.js';
export interface TreeNode {
    file: string;
    label: string;
    depth: number;
    importedSymbols: string[];
    isExternal: boolean;
    children: TreeNode[];
}
export declare function toTreeFormat(result: DependencyResult): object;
export declare function toFlatFormat(result: DependencyResult): object;
export declare function toGraphFormat(result: DependencyResult): object;
export declare function formatDependencyResult(result: DependencyResult, format: string): object;
//# sourceMappingURL=dependency-formatters.d.ts.map