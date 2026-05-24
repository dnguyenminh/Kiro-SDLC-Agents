"use strict";
/**
 * Entity classifier — determines entity type from name pattern.
 * Rule-based: ticket IDs, file paths, @mentions, class names, etc.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyEntity = classifyEntity;
/** Classify an entity name into a type category. */
function classifyEntity(name) {
    if (/^[A-Z][A-Z0-9]+-\d+$/.test(name))
        return 'ticket';
    if (/^@/.test(name))
        return 'person';
    if (/[\\/]/.test(name) || /\.\w{1,5}$/.test(name))
        return 'file';
    if (/^https?:\/\//.test(name))
        return 'url';
    if (/^[A-Z][a-z]+(?:[A-Z][a-z]+)+$/.test(name))
        return 'system';
    return 'concept';
}
//# sourceMappingURL=entity-classifier.js.map