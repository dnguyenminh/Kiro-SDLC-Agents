"use strict";
/**
 * BadgeManager — CRUD operations for context tag badges
 * KSA-252
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BadgeManager = void 0;
class BadgeManager {
    badges = new Map();
    bridge;
    idCounter = 0;
    constructor(bridge) {
        this.bridge = bridge;
    }
    generateId() {
        return `badge-${++this.idCounter}-${Date.now()}`;
    }
    insert(badge) {
        this.badges.set(badge.id, badge);
    }
    remove(badgeId) {
        return this.badges.delete(badgeId);
    }
    getAll() {
        return Array.from(this.badges.values());
    }
    get(badgeId) {
        return this.badges.get(badgeId);
    }
    clear() {
        this.badges.clear();
    }
    count() {
        return this.badges.size;
    }
    async resolveAll() {
        const results = [];
        for (const badge of this.badges.values()) {
            try {
                const content = await this.resolveOne(badge);
                results.push({
                    type: badge.type,
                    label: badge.label,
                    content,
                });
            }
            catch (err) {
                results.push({
                    type: badge.type,
                    label: badge.label,
                    content: `[Error resolving ${badge.label}: ${err.message}]`,
                });
            }
        }
        return results;
    }
    async resolveOne(badge) {
        switch (badge.type) {
            case 'git-diff':
                return this.bridge.resolveGitDiff();
            case 'terminal':
                return this.bridge.resolveTerminalOutput();
            case 'problems': {
                const diags = await this.bridge.resolveDiagnostics();
                return diags.map(d => `${d.severity.toUpperCase()} ${d.file}:${d.line} - ${d.message}`).join('\n');
            }
            case 'current-file': {
                const name = await this.bridge.getActiveFileName();
                return name || '[No active file]';
            }
            case 'files':
            case 'folder':
            case 'spec':
            case 'steering':
            case 'mcp':
                // These are resolved on submit via their metadata
                return `[${badge.type}: ${badge.label}]`;
            default:
                return `[Unknown type: ${badge.type}]`;
        }
    }
}
exports.BadgeManager = BadgeManager;
//# sourceMappingURL=BadgeManager.js.map