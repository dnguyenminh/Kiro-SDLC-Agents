"use strict";
/**
 * KSA-164: CFG Edge — Represents control flow between basic blocks.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CFGEdge = void 0;
class CFGEdge {
    from;
    to;
    type;
    label;
    constructor(from, to, type, label) {
        this.from = from;
        this.to = to;
        this.type = type;
        this.label = label;
    }
    toString() {
        return `B${this.from.id} -[${this.type}]-> B${this.to.id}`;
    }
}
exports.CFGEdge = CFGEdge;
//# sourceMappingURL=CFGEdge.js.map