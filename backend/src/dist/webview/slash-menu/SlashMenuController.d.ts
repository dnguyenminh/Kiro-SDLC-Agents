/**
 * SlashMenuController — State machine + orchestration for Slash Command Menu
 * KSA-254
 *
 * States: CLOSED ↔ OPEN ↔ FILTERING
 * Triggered by '/' at position 0 or after whitespace (BR-01, BR-05)
 */
import type { SlashMenuState, SlashMenuOptions } from './types';
export declare class SlashMenuController {
    private state;
    private view;
    private options;
    private filterText;
    private triggerIndex;
    private agentItems;
    private steeringRules;
    private steeringItems;
    private visibleAgents;
    private visibleSteering;
    private announcer;
    constructor(options: SlashMenuOptions);
    private setupAnnouncer;
    private announce;
    private transition;
    getState(): SlashMenuState;
    isOpen(): boolean;
    getTriggerIndex(): number;
    /**
     * Update steering rules from chat:steeringLoaded message (BR-09)
     */
    setSteeringRules(rules: Array<{
        name: string;
        file: string;
    }>): void;
    /**
     * Check if '/' at the given position is a valid trigger (BR-01, BR-05)
     * Valid: position 0 OR preceded by whitespace
     * Invalid: mid-word (e.g., "http://")
     */
    isValidTrigger(text: string, slashPos: number): boolean;
    /**
     * Open the slash popup at the given trigger position
     */
    open(triggerIndex: number): void;
    /**
     * Close the popup (BR-22: Escape dismisses)
     */
    close(): void;
    /**
     * Filter items based on typed text after '/' (BR-12 through BR-16)
     */
    filter(text: string): void;
    /**
     * Handle keyboard navigation (BR-18 through BR-22)
     */
    handleKeyDown(event: KeyboardEvent): boolean;
    /**
     * Handle mouse click on item (BR-23)
     */
    handleItemClick(index: number): void;
    private selectHighlighted;
    private selectItem;
    getFilterText(): string;
    getVisibleAgentCount(): number;
    getVisibleSteeringCount(): number;
    dispose(): void;
}
//# sourceMappingURL=SlashMenuController.d.ts.map