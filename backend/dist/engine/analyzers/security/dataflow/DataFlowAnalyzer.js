/**
 * KSA-164: Data Flow Analyzer — Computes def-use chains from CFG + reaching definitions.
 */
import { ReachingDefinitions } from './ReachingDefinitions.js';
export class DataFlowAnalyzer {
    reachingDefs = new ReachingDefinitions();
    /** Analyze data flow for a control flow graph. */
    analyze(cfg) {
        const reaching = this.reachingDefs.compute(cfg);
        const allDefs = this.collectAllDefinitions(cfg);
        const chains = this.buildDefUseChains(cfg, reaching, allDefs);
        return {
            reachingDefs: reaching,
            defUseChains: chains,
            definitions: allDefs,
        };
    }
    /** Collect all definitions across all blocks. */
    collectAllDefinitions(cfg) {
        const defs = [];
        let id = 0;
        for (const block of cfg.blocks) {
            for (const varDef of block.getDefinitions()) {
                defs.push({
                    variable: varDef.name,
                    line: varDef.line,
                    blockId: block.id,
                    id: id++,
                });
            }
        }
        return defs;
    }
    /** Build def-use chains: for each definition, find all uses that it reaches. */
    buildDefUseChains(cfg, reaching, allDefs) {
        const chains = [];
        for (const def of allDefs) {
            const uses = [];
            for (const block of cfg.blocks) {
                const reachingHere = reaching.get(block.id);
                if (!reachingHere)
                    continue;
                // Check if this definition reaches this block
                const reaches = Array.from(reachingHere).some(d => d.variable === def.variable && d.line === def.line && d.blockId === def.blockId);
                if (!reaches)
                    continue;
                // Find uses of this variable in the block
                for (const use of block.getUses()) {
                    if (use.name === def.variable) {
                        uses.push({ line: use.line, blockId: block.id });
                    }
                }
            }
            if (uses.length > 0) {
                chains.push({ definition: def, uses });
            }
        }
        return chains;
    }
}
//# sourceMappingURL=DataFlowAnalyzer.js.map