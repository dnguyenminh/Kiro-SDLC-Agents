/**
 * Badge types — KSA-252
 */
import type { ContextSourceType, ContextMetadata, ContextTagBadge } from '../../shared/protocol';
export { ContextSourceType, ContextMetadata, ContextTagBadge };
export interface BadgeRenderOptions {
    container: HTMLElement;
    onRemove: (badgeId: string) => void;
}
//# sourceMappingURL=types.d.ts.map