"use strict";
/**
 * Budget Manager — Enforces max visible node count
 * KSA-143
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BudgetManager = void 0;
class BudgetManager {
    maxVisible;
    currentVisible = 0;
    constructor(maxVisible) {
        this.maxVisible = maxVisible;
    }
    canExpand(cluster) {
        return this.currentVisible + cluster.childCount <= this.maxVisible;
    }
    getFarthestExpanded(clusters) {
        let farthestId = null;
        let farthestDistance = -1;
        for (const [id, state] of clusters) {
            if (state.state === 'EXPANDED' && state.distanceToCamera > farthestDistance) {
                farthestDistance = state.distanceToCamera;
                farthestId = id;
            }
        }
        return farthestId;
    }
    updateCount(delta) {
        this.currentVisible += delta;
    }
    setCount(count) {
        this.currentVisible = count;
    }
    getCount() {
        return this.currentVisible;
    }
    getMax() {
        return this.maxVisible;
    }
    setMax(max) {
        this.maxVisible = max;
    }
}
exports.BudgetManager = BudgetManager;
//# sourceMappingURL=BudgetManager.js.map