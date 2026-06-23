"use strict";
/**
 * AutoLinkConfig — configuration interface and defaults for auto-linking strategies.
 * KSA-190: Auto-Linking Logic on KB Ingest.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultAutoLinkConfig = defaultAutoLinkConfig;
function defaultAutoLinkConfig() {
    return {
        enabled: true,
        semantic: { enabled: true, minScore: 0.75, maxEdges: 5 },
        entity: { enabled: true, minJaccard: 0.3, maxEdges: 5 },
        tag: { enabled: true, minOverlap: 2, maxEdges: 3 },
        fts: { enabled: true, maxEdges: 3, fallbackThreshold: 2 },
        totalMaxEdges: 10,
    };
}
//# sourceMappingURL=auto-link-config.js.map