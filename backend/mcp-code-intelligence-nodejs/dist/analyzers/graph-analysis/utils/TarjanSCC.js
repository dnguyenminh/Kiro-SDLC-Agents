"use strict";
/**
 * KSA-163: Tarjan's Strongly Connected Components algorithm.
 * Finds all cycles in a directed graph.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TarjanSCC = void 0;
class TarjanSCC {
    index = 0;
    stack = [];
    indices = new Map();
    lowlinks = new Map();
    onStack = new Set();
    sccs = [];
    /** Find all strongly connected components with size > 1 (cycles). */
    findSCCs(graph) {
        this.reset();
        for (const node of graph.keys()) {
            if (!this.indices.has(node)) {
                this.strongConnect(node, graph);
            }
        }
        // Only return SCCs with more than 1 node (actual cycles)
        return this.sccs.filter(scc => scc.length > 1);
    }
    strongConnect(v, graph) {
        this.indices.set(v, this.index);
        this.lowlinks.set(v, this.index);
        this.index++;
        this.stack.push(v);
        this.onStack.add(v);
        const neighbors = graph.get(v) || [];
        for (const w of neighbors) {
            if (!this.indices.has(w)) {
                this.strongConnect(w, graph);
                this.lowlinks.set(v, Math.min(this.lowlinks.get(v), this.lowlinks.get(w)));
            }
            else if (this.onStack.has(w)) {
                this.lowlinks.set(v, Math.min(this.lowlinks.get(v), this.indices.get(w)));
            }
        }
        if (this.lowlinks.get(v) === this.indices.get(v)) {
            const scc = [];
            let w;
            do {
                w = this.stack.pop();
                this.onStack.delete(w);
                scc.push(w);
            } while (w !== v);
            this.sccs.push(scc);
        }
    }
    reset() {
        this.index = 0;
        this.stack = [];
        this.indices = new Map();
        this.lowlinks = new Map();
        this.onStack = new Set();
        this.sccs = [];
    }
}
exports.TarjanSCC = TarjanSCC;
//# sourceMappingURL=TarjanSCC.js.map