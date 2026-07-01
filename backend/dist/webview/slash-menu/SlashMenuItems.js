/**
 * SlashMenuItems — Static agent list + dynamic steering rules loader
 * KSA-254
 */
/**
 * Static list of available SDLC agents (BR-07)
 * Sorted alphabetically by agent name
 */
export const SLASH_AGENTS = [
    { id: 'qa', icon: '🧪', label: 'QA Agent', agentName: 'qa-agent', description: 'Quality assurance and testing' },
    { id: 'sa', icon: '🏗️', label: 'SA Agent', agentName: 'sa-agent', description: 'Solution architecture and design' },
    { id: 'security', icon: '🔒', label: 'Security Agent', agentName: 'security-agent', description: 'Security review and compliance' },
    { id: 'sm', icon: '📋', label: 'SM Agent', agentName: 'sm-agent', description: 'Scrum master and pipeline orchestration' },
    { id: 'ta', icon: '🔧', label: 'TA Agent', agentName: 'ta-agent', description: 'Technical analysis and enrichment' },
    { id: 'ui', icon: '🎨', label: 'UI Agent', agentName: 'ui-agent', description: 'UI/UX design and wireframes' },
];
/**
 * Convert static agents to SlashMenuItem format
 */
export function agentsToMenuItems(agents) {
    return agents.map((a) => ({
        id: `agent-${a.id}`,
        icon: a.icon,
        label: a.label,
        description: a.description,
        itemType: 'agent',
        agentName: a.agentName,
    }));
}
/**
 * Convert steering rules to SlashMenuItem format
 */
export function steeringToMenuItems(rules) {
    return rules.map((r) => ({
        id: `steering-${r.name}`,
        icon: r.icon,
        label: r.name,
        itemType: 'steering',
        filePath: r.file,
    }));
}
/**
 * Parse steering rules from chat:steeringLoaded message
 */
export function parseSteeringRules(rules) {
    return rules.map((r) => ({
        name: r.name,
        file: r.file,
        icon: '🧭',
    }));
}
/**
 * Filter agents and steering by query text (BR-12, BR-13)
 * Case-insensitive substring match on label, agentName, and steering name
 */
export function filterSlashItems(agents, steering, filterText) {
    if (!filterText) {
        return { agents: agents.slice(), steering: steering.slice() };
    }
    const lower = filterText.toLowerCase();
    const filteredAgents = agents.filter((a) => {
        return (a.label.toLowerCase().includes(lower) ||
            (a.agentName && a.agentName.toLowerCase().includes(lower)) ||
            (a.description && a.description.toLowerCase().includes(lower)));
    });
    const filteredSteering = steering.filter((r) => {
        return r.label.toLowerCase().includes(lower);
    });
    return { agents: filteredAgents, steering: filteredSteering };
}
//# sourceMappingURL=SlashMenuItems.js.map