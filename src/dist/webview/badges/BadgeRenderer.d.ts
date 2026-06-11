/**
 * BadgeRenderer — DOM rendering for context tag badges
 * KSA-252
 */
import type { ContextTagBadge } from '../../shared/protocol';
export declare class BadgeRenderer {
    private onRemove;
    constructor(onRemove: (badgeId: string) => void);
    createBadgeElement(badge: ContextTagBadge): HTMLSpanElement;
    static removeBadgeElement(container: HTMLElement, badgeId: string): void;
}
//# sourceMappingURL=BadgeRenderer.d.ts.map