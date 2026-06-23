"use strict";
/**
 * ContextUsageTracker — KSA-249
 * Tracks token consumption per category per tab.
 * Categories: conversation, mcpTools, steering.
 * Provides payload for webview context usage panel.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextUsageTracker = void 0;
/** Thresholds for context usage state */
const THRESHOLDS = {
    safe: 0.6,
    warning: 0.8,
    critical: 0.95,
};
class ContextUsageTracker {
    tabUsage = new Map();
    maxTokens;
    constructor(maxTokens = 128000) {
        this.maxTokens = maxTokens;
    }
    /**
     * Update conversation token count from messages.
     */
    updateFromMessages(tabId, messages) {
        const usage = this.getOrCreateUsage(tabId);
        let total = 0;
        for (const msg of messages) {
            total += this.estimateTokens(msg.content);
        }
        usage.conversation = total;
    }
    /**
     * Add tokens from tool results.
     */
    addToolTokens(tabId, toolResult) {
        const usage = this.getOrCreateUsage(tabId);
        usage.mcpTools += this.estimateTokens(toolResult);
    }
    /**
     * Update steering token count from loaded steering content.
     */
    updateSteeringTokens(tabId, steeringContent) {
        const usage = this.getOrCreateUsage(tabId);
        let total = 0;
        for (const content of steeringContent) {
            total += this.estimateTokens(content);
        }
        usage.steering = total;
    }
    /**
     * Set max tokens (e.g., when model changes).
     */
    setMaxTokens(maxTokens) {
        this.maxTokens = maxTokens;
    }
    /**
     * Get the current usage payload for a tab.
     */
    getUsagePayload(tabId) {
        const usage = this.getOrCreateUsage(tabId);
        const total = usage.conversation + usage.mcpTools + usage.steering;
        const percentage = this.maxTokens > 0
            ? Math.min(100, Math.round((total / this.maxTokens) * 100))
            : 0;
        return {
            tabId,
            conversation: {
                tokens: usage.conversation,
                percentage: this.pct(usage.conversation),
            },
            mcpTools: {
                tokens: usage.mcpTools,
                percentage: this.pct(usage.mcpTools),
            },
            steering: {
                tokens: usage.steering,
                percentage: this.pct(usage.steering),
            },
            total: {
                tokens: total,
                percentage,
                threshold: this.getThreshold(percentage),
            },
            maxTokens: this.maxTokens,
        };
    }
    /**
     * Clear usage data for a tab.
     */
    clearTab(tabId) {
        this.tabUsage.delete(tabId);
    }
    estimateTokens(text) {
        if (!text)
            return 0;
        return Math.ceil(text.length / 4);
    }
    pct(tokens) {
        return this.maxTokens > 0 ? Math.round((tokens / this.maxTokens) * 100) : 0;
    }
    getThreshold(percentage) {
        const ratio = percentage / 100;
        if (ratio >= THRESHOLDS.critical)
            return "full";
        if (ratio >= THRESHOLDS.warning)
            return "critical";
        if (ratio >= THRESHOLDS.safe)
            return "warning";
        return "safe";
    }
    getOrCreateUsage(tabId) {
        let usage = this.tabUsage.get(tabId);
        if (!usage) {
            usage = { conversation: 0, mcpTools: 0, steering: 0 };
            this.tabUsage.set(tabId, usage);
        }
        return usage;
    }
}
exports.ContextUsageTracker = ContextUsageTracker;
//# sourceMappingURL=context-usage-tracker.js.map