/**
 * SlashMenuController — State machine + orchestration for Slash Command Menu
 * KSA-254
 *
 * States: CLOSED ↔ OPEN ↔ FILTERING
 * Triggered by '/' at position 0 or after whitespace (BR-01, BR-05)
 */
import { SlashMenuView } from './SlashMenuView';
import { SLASH_AGENTS, agentsToMenuItems, steeringToMenuItems, parseSteeringRules, filterSlashItems, } from './SlashMenuItems';
const TRANSITIONS = [
    { from: 'CLOSED', to: 'OPEN', trigger: 'SLASH_TYPED' },
    { from: 'OPEN', to: 'FILTERING', trigger: 'CHAR_TYPED' },
    { from: 'OPEN', to: 'CLOSED', trigger: 'AGENT_SELECTED' },
    { from: 'OPEN', to: 'CLOSED', trigger: 'STEERING_SELECTED' },
    { from: 'OPEN', to: 'CLOSED', trigger: 'DISMISS' },
    { from: 'FILTERING', to: 'OPEN', trigger: 'FILTER_CLEARED' },
    { from: 'FILTERING', to: 'CLOSED', trigger: 'AGENT_SELECTED' },
    { from: 'FILTERING', to: 'CLOSED', trigger: 'STEERING_SELECTED' },
    { from: 'FILTERING', to: 'CLOSED', trigger: 'DISMISS' },
];
export class SlashMenuController {
    state = 'CLOSED';
    view;
    options;
    filterText = '';
    triggerIndex = -1;
    // Data sources
    agentItems;
    steeringRules = [];
    steeringItems = [];
    // Filtered results
    visibleAgents;
    visibleSteering = [];
    // Screen reader announcer
    announcer = null;
    constructor(options) {
        this.options = options;
        this.view = new SlashMenuView(options.container);
        this.agentItems = agentsToMenuItems(SLASH_AGENTS);
        this.visibleAgents = [...this.agentItems];
        this.setupAnnouncer();
    }
    setupAnnouncer() {
        this.announcer = document.getElementById('sr-announcer');
        if (!this.announcer) {
            this.announcer = document.createElement('div');
            this.announcer.id = 'sr-announcer';
            this.announcer.setAttribute('aria-live', 'polite');
            this.announcer.setAttribute('aria-atomic', 'true');
            this.announcer.className = 'sr-only';
            document.body.appendChild(this.announcer);
        }
    }
    announce(message) {
        if (this.announcer) {
            this.announcer.textContent = '';
            requestAnimationFrame(() => {
                if (this.announcer)
                    this.announcer.textContent = message;
            });
        }
    }
    transition(trigger) {
        const valid = TRANSITIONS.find((t) => t.from === this.state && t.trigger === trigger);
        if (!valid)
            return false;
        this.state = valid.to;
        return true;
    }
    getState() {
        return this.state;
    }
    isOpen() {
        return this.state !== 'CLOSED';
    }
    getTriggerIndex() {
        return this.triggerIndex;
    }
    /**
     * Update steering rules from chat:steeringLoaded message (BR-09)
     */
    setSteeringRules(rules) {
        this.steeringRules = parseSteeringRules(rules);
        this.steeringItems = steeringToMenuItems(this.steeringRules);
        this.visibleSteering = [...this.steeringItems];
    }
    /**
     * Check if '/' at the given position is a valid trigger (BR-01, BR-05)
     * Valid: position 0 OR preceded by whitespace
     * Invalid: mid-word (e.g., "http://")
     */
    isValidTrigger(text, slashPos) {
        if (slashPos === 0)
            return true;
        const charBefore = text[slashPos - 1];
        return charBefore === ' ' || charBefore === '\t' || charBefore === '\n';
    }
    /**
     * Open the slash popup at the given trigger position
     */
    open(triggerIndex) {
        if (!this.transition('SLASH_TYPED'))
            return;
        this.triggerIndex = triggerIndex;
        this.filterText = '';
        this.visibleAgents = [...this.agentItems];
        this.visibleSteering = [...this.steeringItems];
        const rect = this.options.inputElement.getBoundingClientRect();
        this.view.render(this.visibleAgents, this.visibleSteering, rect);
        const total = this.visibleAgents.length + this.visibleSteering.length;
        this.announce(`Slash commands menu opened. ${total} items available. Use arrow keys to navigate.`);
    }
    /**
     * Close the popup (BR-22: Escape dismisses)
     */
    close() {
        this.transition('DISMISS');
        this.view.destroy();
        this.filterText = '';
        this.triggerIndex = -1;
        this.options.onClose();
    }
    /**
     * Filter items based on typed text after '/' (BR-12 through BR-16)
     */
    filter(text) {
        this.filterText = text;
        if (!text) {
            this.transition('FILTER_CLEARED');
            this.visibleAgents = [...this.agentItems];
            this.visibleSteering = [...this.steeringItems];
        }
        else {
            if (this.state === 'OPEN')
                this.transition('CHAR_TYPED');
            const result = filterSlashItems(this.agentItems, this.steeringItems, text);
            this.visibleAgents = result.agents;
            this.visibleSteering = result.steering;
        }
        this.view.updateItems(this.visibleAgents, this.visibleSteering);
        const total = this.visibleAgents.length + this.visibleSteering.length;
        this.announce(`${total} commands match.`);
    }
    /**
     * Handle keyboard navigation (BR-18 through BR-22)
     */
    handleKeyDown(event) {
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.view.moveHighlight('down');
                return true;
            case 'ArrowUp':
                event.preventDefault();
                this.view.moveHighlight('up');
                return true;
            case 'Enter':
            case 'Tab':
                event.preventDefault();
                this.selectHighlighted();
                return true;
            case 'Escape':
                event.preventDefault();
                this.close();
                return true;
            default:
                return false;
        }
    }
    /**
     * Handle mouse click on item (BR-23)
     */
    handleItemClick(index) {
        const item = this.view.getItemAtIndex(index);
        if (item)
            this.selectItem(item);
    }
    selectHighlighted() {
        const item = this.view.getHighlightedItem();
        if (item)
            this.selectItem(item);
    }
    selectItem(item) {
        if (item.itemType === 'agent') {
            this.transition('AGENT_SELECTED');
            this.view.destroy();
            this.options.onAgentSelect(item.agentName);
            this.announce(`Agent selected: ${item.label}`);
        }
        else if (item.itemType === 'steering') {
            this.transition('STEERING_SELECTED');
            this.view.destroy();
            const rule = this.steeringRules.find((r) => r.name === item.label);
            if (rule) {
                this.options.onSteeringSelect(rule);
                this.announce(`Steering rule attached: ${item.label}`);
            }
        }
        this.filterText = '';
        this.triggerIndex = -1;
    }
    getFilterText() {
        return this.filterText;
    }
    getVisibleAgentCount() {
        return this.visibleAgents.length;
    }
    getVisibleSteeringCount() {
        return this.visibleSteering.length;
    }
    dispose() {
        this.close();
    }
}
//# sourceMappingURL=SlashMenuController.js.map