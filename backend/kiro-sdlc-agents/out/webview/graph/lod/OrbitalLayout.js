"use strict";
/**
 * Orbital Layout — Radial positioning of child nodes around cluster center
 * KSA-143
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrbitalLayout = void 0;
class OrbitalLayout {
    static compute(childCount, center, radius) {
        const positions = [];
        if (childCount <= 20) {
            // Single ring
            for (let i = 0; i < childCount; i++) {
                const angle = (2 * Math.PI * i) / childCount;
                positions.push({
                    x: center.x + radius * Math.cos(angle),
                    y: center.y + (Math.random() - 0.5) * radius * 0.3,
                    z: center.z + radius * Math.sin(angle),
                });
            }
        }
        else {
            // Two concentric rings
            const innerCount = Math.min(10, Math.floor(childCount / 3));
            const outerCount = childCount - innerCount;
            const innerRadius = radius * 0.5;
            const outerRadius = radius * 0.8;
            // Inner ring
            for (let i = 0; i < innerCount; i++) {
                const angle = (2 * Math.PI * i) / innerCount;
                positions.push({
                    x: center.x + innerRadius * Math.cos(angle),
                    y: center.y + (Math.random() - 0.5) * innerRadius * 0.2,
                    z: center.z + innerRadius * Math.sin(angle),
                });
            }
            // Outer ring
            for (let i = 0; i < outerCount; i++) {
                const angle = (2 * Math.PI * i) / outerCount;
                positions.push({
                    x: center.x + outerRadius * Math.cos(angle),
                    y: center.y + (Math.random() - 0.5) * outerRadius * 0.3,
                    z: center.z + outerRadius * Math.sin(angle),
                });
            }
        }
        return positions;
    }
}
exports.OrbitalLayout = OrbitalLayout;
//# sourceMappingURL=OrbitalLayout.js.map