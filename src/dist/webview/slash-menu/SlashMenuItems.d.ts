/**
 * SlashMenuItems — Static agent list + dynamic steering rules loader
 * KSA-254
 */
import type { SlashAgent, SlashSteeringRule, SlashMenuItem } from './types';
/**
 * Static list of available SDLC agents (BR-07)
 * Sorted alphabetically by agent name
 */
export declare const SLASH_AGENTS: SlashAgent[];
/**
 * Convert static agents to SlashMenuItem format
 */
export declare function agentsToMenuItems(agents: SlashAgent[]): SlashMenuItem[];
/**
 * Convert steering rules to SlashMenuItem format
 */
export declare function steeringToMenuItems(rules: SlashSteeringRule[]): SlashMenuItem[];
/**
 * Parse steering rules from chat:steeringLoaded message
 */
export declare function parseSteeringRules(rules: Array<{
    name: string;
    file: string;
}>): SlashSteeringRule[];
/**
 * Filter agents and steering by query text (BR-12, BR-13)
 * Case-insensitive substring match on label, agentName, and steering name
 */
export declare function filterSlashItems(agents: SlashMenuItem[], steering: SlashMenuItem[], filterText: string): {
    agents: SlashMenuItem[];
    steering: SlashMenuItem[];
};
//# sourceMappingURL=SlashMenuItems.d.ts.map