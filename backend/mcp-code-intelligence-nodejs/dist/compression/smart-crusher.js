"use strict";
/**
 * SmartCrusher — JSON Array Compression (CORE)
 * KSA-244: Entropy-based field analysis + strategy selection + item sampling
 *
 * Achieves 60-90% compression on JSON arrays while preserving semantic meaning.
 * Budget: < 5ms for 100 items, < 10ms total pipeline.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartCrusher = void 0;
class SmartCrusher {
    /**
     * Compress a JSON array using entropy-based field analysis.
     * Returns original if compression is not beneficial.
     */
    compress(items, options = {}) {
        const { targetRatio = 0.3, preserveFields = [] } = options;
        // BR-10: Min array size
        if (items.length < 5) {
            return this.skip(items);
        }
        // Handle primitive arrays (not objects)
        if (typeof items[0] !== 'object' || items[0] === null) {
            return this.samplePrimitives(items, targetRatio);
        }
        const fields = Object.keys(items[0] ?? {});
        if (fields.length === 0) {
            return this.skip(items);
        }
        // Phase 1: Field entropy analysis
        // Entropy = uniqueValues / totalItems (0 = all same, 1 = all different)
        const entropy = new Map();
        for (const f of fields) {
            const values = new Set();
            for (const item of items) {
                values.add(String(item[f] ?? ''));
            }
            entropy.set(f, values.size / items.length);
        }
        // BR-12: Low entropy threshold < 0.2
        const lowEntropy = fields.filter(f => (entropy.get(f) < 0.2) && !preserveFields.includes(f));
        // Phase 2: Strategy selection
        const strategy = lowEntropy.length > fields.length * 0.5
            ? 'field_reduction'
            : lowEntropy.length === 0
                ? 'item_sampling'
                : 'hybrid';
        // Phase 3: Execute compression
        let result = items;
        // Field reduction: remove low-entropy fields
        if (strategy !== 'item_sampling') {
            result = result.map(item => {
                const reduced = {};
                for (const k of Object.keys(item)) {
                    if (!lowEntropy.includes(k)) {
                        reduced[k] = item[k];
                    }
                }
                return reduced;
            });
        }
        // Item sampling: evenly-spaced selection
        if (strategy !== 'field_reduction') {
            const keep = Math.max(3, Math.ceil(result.length * targetRatio));
            const step = result.length / keep;
            result = Array.from({ length: keep }, (_, i) => result[Math.floor(i * step)]);
        }
        // BR-14: Summary header
        const header = `[COMPRESSED: ${items.length} items -> ${result.length} items (${Math.round((1 - result.length / items.length) * 100)}% reduction)]\n`;
        const compressed = header + JSON.stringify(result);
        const original = JSON.stringify(items);
        // BR-15: If compressed >= original, return original
        if (compressed.length >= original.length) {
            return this.skip(items);
        }
        return {
            compressed,
            originalSize: original.length,
            compressedSize: compressed.length,
            ratio: compressed.length / original.length,
            strategy,
            skipped: false,
        };
    }
    skip(items) {
        const original = JSON.stringify(items);
        return {
            compressed: original,
            originalSize: original.length,
            compressedSize: original.length,
            ratio: 1,
            strategy: 'none',
            skipped: true,
        };
    }
    samplePrimitives(items, targetRatio) {
        const original = JSON.stringify(items);
        if (items.length < 5) {
            return this.skip(items);
        }
        const keep = Math.max(3, Math.ceil(items.length * targetRatio));
        const step = items.length / keep;
        const sampled = Array.from({ length: keep }, (_, i) => items[Math.floor(i * step)]);
        const header = `[COMPRESSED: ${items.length} items -> ${sampled.length} items (${Math.round((1 - sampled.length / items.length) * 100)}% reduction)]\n`;
        const compressed = header + JSON.stringify(sampled);
        if (compressed.length >= original.length) {
            return this.skip(items);
        }
        return {
            compressed,
            originalSize: original.length,
            compressedSize: compressed.length,
            ratio: compressed.length / original.length,
            strategy: 'item_sampling',
            skipped: false,
        };
    }
}
exports.SmartCrusher = SmartCrusher;
//# sourceMappingURL=smart-crusher.js.map