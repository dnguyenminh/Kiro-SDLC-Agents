/**
 * Graph cache — persists DependencyGraph to JSON file.
 */
import { DependencyGraph } from './dependency-graph.js';
export declare class GraphCache {
    private cachePath;
    constructor(projectRoot: string);
    load(): DependencyGraph | null;
    save(graph: DependencyGraph): void;
    invalidate(): void;
}
//# sourceMappingURL=graph-cache.d.ts.map