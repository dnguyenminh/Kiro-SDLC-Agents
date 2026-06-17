/**
 * BadgeManager — CRUD operations for context tag badges
 * KSA-252
 */
import type { ContextTagBadge, ResolvedContext } from '../../shared/protocol';
import { MessageBridge } from '../bridge/MessageBridge';
export declare class BadgeManager {
    private badges;
    private bridge;
    private idCounter;
    constructor(bridge: MessageBridge);
    generateId(): string;
    insert(badge: ContextTagBadge): void;
    remove(badgeId: string): boolean;
    getAll(): ContextTagBadge[];
    get(badgeId: string): ContextTagBadge | undefined;
    clear(): void;
    count(): number;
    resolveAll(): Promise<ResolvedContext[]>;
    private resolveOne;
}
//# sourceMappingURL=BadgeManager.d.ts.map