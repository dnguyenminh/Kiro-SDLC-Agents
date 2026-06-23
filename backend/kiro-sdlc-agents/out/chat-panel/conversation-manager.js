"use strict";
/**
 * ConversationManager — KSA-240
 * Manages multiple conversation tabs with independent contexts.
 * Each tab has its own message history, token count, and state.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationManager = void 0;
const uuid_1 = require("uuid");
class ConversationManager {
    tabs = new Map();
    activeTabId = "";
    maxTabs;
    tabCounter = 0;
    constructor(maxTabs = 10) {
        this.maxTabs = maxTabs;
        // Create initial tab
        this.createTab();
    }
    createTab() {
        if (this.tabs.size >= this.maxTabs) {
            throw new Error(`Maximum ${this.maxTabs} tabs reached`);
        }
        this.tabCounter++;
        const tab = {
            id: (0, uuid_1.v4)(),
            name: `Chat ${this.tabCounter}`,
            messages: [],
            tokenCount: 0,
            maxTokens: 128000, // Default, updated per provider/model
            isActive: true,
            createdAt: new Date().toISOString(),
            scrollPosition: 0,
            draftMessage: "",
        };
        // Deactivate current active tab
        if (this.activeTabId) {
            const current = this.tabs.get(this.activeTabId);
            if (current) {
                current.isActive = false;
            }
        }
        this.tabs.set(tab.id, tab);
        this.activeTabId = tab.id;
        return tab;
    }
    switchTab(tabId) {
        const target = this.tabs.get(tabId);
        if (!target) {
            throw new Error(`Tab ${tabId} not found`);
        }
        // Save current tab state
        if (this.activeTabId && this.activeTabId !== tabId) {
            const current = this.tabs.get(this.activeTabId);
            if (current) {
                current.isActive = false;
            }
        }
        target.isActive = true;
        this.activeTabId = tabId;
        return target;
    }
    closeTab(tabId) {
        if (this.tabs.size <= 1) {
            throw new Error("Cannot close the last tab");
        }
        const closedTab = this.tabs.get(tabId);
        if (!closedTab) {
            throw new Error(`Tab ${tabId} not found`);
        }
        // Determine new active tab (prefer left neighbor, fallback right)
        let newActiveTab = null;
        if (closedTab.isActive) {
            const tabIds = Array.from(this.tabs.keys());
            const idx = tabIds.indexOf(tabId);
            const newIdx = idx > 0 ? idx - 1 : idx + 1;
            const newActiveId = tabIds[newIdx];
            newActiveTab = this.tabs.get(newActiveId) || null;
            if (newActiveTab) {
                newActiveTab.isActive = true;
                this.activeTabId = newActiveTab.id;
            }
        }
        this.tabs.delete(tabId);
        return { closedTab, newActiveTab };
    }
    renameTab(tabId, name) {
        const tab = this.tabs.get(tabId);
        if (!tab) {
            throw new Error(`Tab ${tabId} not found`);
        }
        const trimmed = name.trim();
        if (!trimmed) {
            return; // Keep existing name if empty
        }
        tab.name = trimmed.substring(0, 30); // Max 30 chars
    }
    addMessage(tabId, message) {
        const tab = this.tabs.get(tabId);
        if (!tab) {
            throw new Error(`Tab ${tabId} not found`);
        }
        tab.messages.push(message);
        tab.tokenCount += message.tokenCount;
    }
    updateTokenCount(tabId, tokenCount) {
        const tab = this.tabs.get(tabId);
        if (tab) {
            tab.tokenCount = tokenCount;
        }
    }
    setMaxTokens(tabId, maxTokens) {
        const tab = this.tabs.get(tabId);
        if (tab) {
            tab.maxTokens = maxTokens;
        }
    }
    saveDraft(tabId, draft) {
        const tab = this.tabs.get(tabId);
        if (tab) {
            tab.draftMessage = draft;
        }
    }
    saveScrollPosition(tabId, position) {
        const tab = this.tabs.get(tabId);
        if (tab) {
            tab.scrollPosition = position;
        }
    }
    getActiveTab() {
        return this.tabs.get(this.activeTabId);
    }
    getTab(tabId) {
        return this.tabs.get(tabId);
    }
    getAllTabs() {
        return Array.from(this.tabs.values());
    }
    getTabCount() {
        return this.tabs.size;
    }
    getActiveTabId() {
        return this.activeTabId;
    }
    canCreateTab() {
        return this.tabs.size < this.maxTabs;
    }
    hasMessages(tabId) {
        const tab = this.tabs.get(tabId);
        return tab ? tab.messages.length > 0 : false;
    }
}
exports.ConversationManager = ConversationManager;
//# sourceMappingURL=conversation-manager.js.map