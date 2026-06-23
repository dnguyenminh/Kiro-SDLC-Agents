"use strict";
/**
 * Distance Checker — Per-frame camera distance evaluation
 * KSA-143
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DistanceChecker = void 0;
class DistanceChecker {
    expandThreshold;
    collapseThreshold;
    constructor(expandThreshold, collapseThreshold) {
        this.expandThreshold = expandThreshold;
        this.collapseThreshold = collapseThreshold;
    }
    evaluate(cameraPosition, clusters) {
        const events = [];
        for (const [id, state] of clusters) {
            const distance = this.distanceTo(cameraPosition, state.cluster.center);
            state.distanceToCamera = distance;
            if (state.state === 'COLLAPSED' && distance < this.expandThreshold) {
                events.push({ type: 'EXPAND', clusterId: id });
            }
            else if (state.state === 'EXPANDED' && distance > this.collapseThreshold) {
                events.push({ type: 'COLLAPSE', clusterId: id });
            }
        }
        events.sort((a, b) => {
            const distA = clusters.get(a.clusterId)?.distanceToCamera ?? Infinity;
            const distB = clusters.get(b.clusterId)?.distanceToCamera ?? Infinity;
            return distA - distB;
        });
        return events;
    }
    setThresholds(expand, collapse) {
        this.expandThreshold = expand;
        this.collapseThreshold = collapse;
    }
    distanceTo(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
}
exports.DistanceChecker = DistanceChecker;
//# sourceMappingURL=DistanceChecker.js.map