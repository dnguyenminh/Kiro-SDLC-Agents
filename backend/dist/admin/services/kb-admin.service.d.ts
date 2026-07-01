import { KBPromotionEntry, PaginatedResult, PaginationParams } from '../types/admin.types.js';
export declare class KBAdminService {
    private db;
    private kbEngine;
    constructor(db: any, kbEngine: any);
    listEntries(filters: {
        tier?: string;
        tags?: string;
        search?: string;
    }, pagination: PaginationParams): PaginatedResult<any>;
    createLink(sourceId: string, targetId: string, linkType?: string): void;
    removeLink(sourceId: string, targetId: string): void;
    updateTags(entryId: string, tags: string[]): void;
    reviewPromotion(data: {
        entryId: string;
        decision: 'APPROVE' | 'REJECT';
        comment: string;
        targetTier?: string;
    }, reviewerId: string): void;
    listPromotions(): KBPromotionEntry[];
    getGraphData(filters: {
        tier?: string;
        minQuality?: number;
        limit?: number;
    }): any;
    private hasCircularLink;
}
