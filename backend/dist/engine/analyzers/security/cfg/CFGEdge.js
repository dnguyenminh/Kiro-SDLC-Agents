/**
 * KSA-164: CFG Edge — Represents control flow between basic blocks.
 */
export class CFGEdge {
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
//# sourceMappingURL=CFGEdge.js.map