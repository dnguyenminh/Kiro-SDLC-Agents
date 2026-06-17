# Technical Design Document (TDD)

## FEC CR Builder — KSA-240: Chat Panel UI: Context Window Usage Icon + Conversation Tabs

---

## Document Information

| Field | Value |
|-------|-------|
| Jira Ticket | KSA-240 |
| Title | Chat Panel UI: Context Window Usage Icon + Conversation Tabs |
| Author | SA Agent |
| Version | 1.0 |
| Date | 2026-06-07 |
| Status | Draft |
| Related FSD | FSD-v1-KSA-240.docx |
| Related BRD | BRD-v1-KSA-240.docx |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-07 | SA Agent | Initial technical design |

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

![Architecture](diagrams/architecture.png)

The feature follows the standard VS Code Webview extension pattern with clear separation between:

- **Webview Layer** (HTML/CSS/JS): UI rendering, user interactions
- **Extension Host Layer** (TypeScript): Business logic, state management, LLM communication
- **Communication Layer**: VS Code postMessage API (bidirectional)

### 1.2 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Webview UI | HTML5 + CSS3 + Vanilla JS | Lightweight rendering, no framework dependency |
| Extension Host | TypeScript 5.x | Business logic, VS Code API integration |
| State Management | In-memory Map + Disposable pattern | Conversation tabs, token counts |
| Build | esbuild / webpack | Bundle webview assets |
| Testing | Vitest + @vscode/test-electron | Unit + integration tests |

### 1.3 Design Principles

1. **Single Responsibility**: Each class handles one concern
2. **Message-based Communication**: Webview and host communicate only via typed messages
3. **Immutable State Updates**: Tab state changes produce new state objects
4. **Graceful Degradation**: If token counter fails, UI still functions

---

## 2. Component Design

### 2.1 Component Diagram

![Component Diagram](diagrams/component.png)

### 2.2 Extension Host Components

#### 2.2.1 ChatPanelProvider

```typescript
class ChatPanelProvider implements vscode.WebviewViewProvider {
  private conversationManager: ConversationManager;
  private tokenCounter: TokenCounter;
  private view: vscode.WebviewView | undefined;

  resolveWebviewView(view: vscode.WebviewView): void;
  private handleMessage(message: WebviewMessage): void;
  private postToWebview(message: HostMessage): void;
  dispose(): void;
}
```

**Responsibility:** Manages webview lifecycle, routes messages between webview and services.

#### 2.2.2 ConversationManager

```typescript
class ConversationManager {
  private tabs: Map<string, ConversationTab>;
  private activeTabId: string;
  private maxTabs: number = 10;

  createTab(): ConversationTab;
  switchTab(tabId: string): ConversationTab;
  closeTab(tabId: string): { closedTab: ConversationTab, newActiveTab: ConversationTab | null };
  renameTab(tabId: string, name: string): void;
  addMessage(tabId: string, message: Message): void;
  getActiveTab(): ConversationTab;
  getAllTabs(): ConversationTab[];
  getTabCount(): number;
}
```

**Responsibility:** CRUD operations on conversation tabs, maintains active state.

#### 2.2.3 TokenCounter

```typescript
class TokenCounter {
  private encoder: Tiktoken | null;

  countTokens(messages: Message[]): number;
  getMaxTokens(provider: string, model: string): number;
  getUsagePercentage(tab: ConversationTab): number;
  getThresholdState(percentage: number): 'safe' | 'warning' | 'critical' | 'full';
}
```

**Responsibility:** Calculates token usage using tiktoken or provider-specific tokenizer.

### 2.3 Webview Components

#### 2.3.1 TabBarComponent

```typescript
class TabBarComponent {
  private container: HTMLElement;
  private tabs: TabElement[];

  render(tabs: ConversationTab[], activeTabId: string): void;
  private createTabElement(tab: ConversationTab): HTMLElement;
  private handleTabClick(tabId: string): void;
  private handleCloseClick(tabId: string): void;
  private handleDoubleClick(tabId: string): void;
  private handleAddClick(): void;
}
```

#### 2.3.2 ContextUsageIconComponent

```typescript
class ContextUsageIconComponent {
  private svgElement: SVGElement;
  private tooltipElement: HTMLElement;

  render(tokenCount: number, maxTokens: number): void;
  private calculateArc(percentage: number): string;
  private getColor(percentage: number): string;
  private triggerPulse(): void;
  private showTooltip(): void;
  private hideTooltip(): void;
}
```

#### 2.3.3 MessageListComponent

```typescript
class MessageListComponent {
  private container: HTMLElement;
  private scrollPosition: number;

  render(messages: Message[]): void;
  appendMessage(message: Message): void;
  saveScrollPosition(): number;
  restoreScrollPosition(position: number): void;
}
```

---

## 3. API Design

### 3.1 Message Protocol (Extension Host <-> Webview)

#### 3.1.1 Type Definitions

```typescript
// Webview -> Extension Host
type WebviewMessage =
  | { type: 'createTab' }
  | { type: 'switchTab'; payload: { tabId: string } }
  | { type: 'closeTab'; payload: { tabId: string } }
  | { type: 'renameTab'; payload: { tabId: string; newName: string } }
  | { type: 'sendMessage'; payload: { tabId: string; content: string } };

// Extension Host -> Webview
type HostMessage =
  | { type: 'tabsUpdated'; payload: { tabs: ConversationTab[]; activeTabId: string } }
  | { type: 'contextUpdate'; payload: { tabId: string; tokenCount: number; maxTokens: number } }
  | { type: 'messageReceived'; payload: { tabId: string; message: Message } }
  | { type: 'error'; payload: { code: string; message: string } };
```

### 3.2 VS Code Commands (registered)

| Command ID | Description | Keybinding |
|-----------|-------------|------------|
| chatPanel.newTab | Create new conversation tab | Ctrl+Shift+T |
| chatPanel.closeTab | Close active tab | Ctrl+W |
| chatPanel.nextTab | Switch to next tab | Ctrl+Tab |
| chatPanel.prevTab | Switch to previous tab | Ctrl+Shift+Tab |

---

## 4. Data Model

### 4.1 In-Memory State Structure

```typescript
interface ChatPanelState {
  tabs: Map<string, ConversationTab>;
  activeTabId: string;
  config: ChatPanelConfig;
}

interface ChatPanelConfig {
  maxTabs: number;           // default: 10
  warningThreshold: number;  // default: 0.8 (80%)
  criticalThreshold: number; // default: 0.95 (95%)
  maxTabNameLength: number;  // default: 30
}

interface ConversationTab {
  id: string;
  name: string;
  messages: Message[];
  tokenCount: number;
  maxTokens: number;
  isActive: boolean;
  createdAt: string;
  scrollPosition: number;
  draftMessage: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  tokenCount: number;
}
```

### 4.2 State Persistence (Future)

Currently in-memory only. Tabs reset on panel close/reload. Future: serialize to VS Code globalState.

---

## 5. Implementation Checklist

### 5.1 Files to Create

| # | File Path | Purpose | Component |
|---|-----------|---------|-----------|
| 1 | `src/chat/ChatPanelProvider.ts` | Webview provider, message routing | Extension Host |
| 2 | `src/chat/ConversationManager.ts` | Tab CRUD, state management | Extension Host |
| 3 | `src/chat/TokenCounter.ts` | Token counting service | Extension Host |
| 4 | `src/chat/types.ts` | Shared TypeScript interfaces | Shared |
| 5 | `src/chat/webview/index.html` | Webview HTML shell | Webview |
| 6 | `src/chat/webview/main.ts` | Webview entry point | Webview |
| 7 | `src/chat/webview/TabBar.ts` | Tab bar component | Webview |
| 8 | `src/chat/webview/ContextUsageIcon.ts` | Context icon SVG component | Webview |
| 9 | `src/chat/webview/MessageList.ts` | Message rendering component | Webview |
| 10 | `src/chat/webview/styles.css` | All webview styles | Webview |

### 5.2 Files to Modify

| # | File Path | Change |
|---|-----------|--------|
| 1 | `package.json` | Add webview view contribution, commands, keybindings |
| 2 | `src/extension.ts` | Register ChatPanelProvider |

### 5.3 Implementation Order

1. `types.ts` — define all interfaces
2. `ConversationManager.ts` — core state logic
3. `TokenCounter.ts` — token calculation
4. `ChatPanelProvider.ts` — webview lifecycle + message routing
5. Webview: `index.html` + `styles.css` + `main.ts`
6. Webview components: `TabBar.ts`, `ContextUsageIcon.ts`, `MessageList.ts`
7. `package.json` contributions + `extension.ts` registration

---

## 6. Error Handling

| Scenario | Component | Strategy |
|----------|-----------|----------|
| Token counter init fails | TokenCounter | Fallback to character-based estimation |
| postMessage fails | ChatPanelProvider | Log error, retry once, show error toast |
| Tab creation at max limit | ConversationManager | Throw MaxTabsError, UI disables button |
| Invalid tab rename (empty) | ConversationManager | Revert to previous name |
| Webview disposed unexpectedly | ChatPanelProvider | Re-create on next access |
| Message too large for context | TokenCounter | Report to UI, suggest new tab |

---

## 7. Security Design

| Concern | Mitigation |
|---------|-----------|
| XSS in message content | Sanitize all user content before rendering in webview |
| Message injection | Validate message types with TypeScript discriminated unions |
| Content Security Policy | Set strict CSP in webview HTML (no inline scripts, no external resources) |
| Data exposure | No sensitive data stored; conversations are ephemeral |

---

## 8. Performance Considerations

| Aspect | Strategy | Target |
|--------|----------|--------|
| Icon update speed | Debounce recalculation to 100ms | < 500ms perceived |
| Tab switch rendering | Keep inactive tab DOM in memory (hidden) | < 200ms |
| Large conversations | Virtual scrolling for messages > 100 | Constant memory |
| Token counting | Cache count per message, only count new messages | O(1) for incremental |
| Bundle size | Tree-shake, no heavy dependencies | < 50KB webview bundle |

---

## 9. Testing Strategy

| Level | What to Test | Tool |
|-------|-------------|------|
| Unit | ConversationManager CRUD logic | Vitest |
| Unit | TokenCounter accuracy | Vitest |
| Unit | Webview components (DOM output) | Vitest + jsdom |
| Integration | Message protocol (host <-> webview) | @vscode/test-electron |
| E2E | Full user flow (create tab, send msg, switch) | @vscode/test-electron |

---

## 10. Appendix

### 10.1 CSS Variables Used

```css
/* VS Code theme integration */
--vscode-badge-background
--vscode-badge-foreground
--vscode-focusBorder
--vscode-editor-background
--vscode-editor-foreground
--vscode-input-background
--vscode-input-border
--vscode-button-background
--vscode-button-foreground
--vscode-tab-activeBackground
--vscode-tab-inactiveBackground
--vscode-tab-border
```

### 10.2 Diagram Index

| # | Diagram | Image | Source (editable) |
|---|---------|-------|-------------------|
| 1 | Architecture | [architecture.png](diagrams/architecture.png) | [architecture.drawio](diagrams/architecture.drawio) |
| 2 | Component | [component.png](diagrams/component.png) | [component.drawio](diagrams/component.drawio) |
