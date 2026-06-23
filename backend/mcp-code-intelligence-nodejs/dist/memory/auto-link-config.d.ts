/**
 * AutoLinkConfig — configuration interface and defaults for auto-linking strategies.
 * KSA-190: Auto-Linking Logic on KB Ingest.
 */
export interface AutoLinkConfig {
    enabled: boolean;
    semantic: {
        enabled: boolean;
        minScore: number;
        maxEdges: number;
    };
    entity: {
        enabled: boolean;
        minJaccard: number;
        maxEdges: number;
    };
    tag: {
        enabled: boolean;
        minOverlap: number;
        maxEdges: number;
    };
    fts: {
        enabled: boolean;
        maxEdges: number;
        fallbackThreshold: number;
    };
    totalMaxEdges: number;
}
export declare function defaultAutoLinkConfig(): AutoLinkConfig;
//# sourceMappingURL=auto-link-config.d.ts.map