"use strict";
/**
 * ToolRegistry — caches tool metadata fetched from Backend.
 * Implements TDD §4.1 ToolRegistry.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolRegistry = void 0;
class ToolRegistry {
    tools = new Map();
    update(definitions) {
        // Mark all existing as unregistered
        for (const entry of this.tools.values()) {
            entry.registered = false;
        }
        // Update/add from new list
        for (const def of definitions) {
            this.tools.set(def.name, { ...def, registered: true });
        }
        // Remove tools no longer in backend
        for (const [name, entry] of this.tools) {
            if (!entry.registered) {
                this.tools.delete(name);
            }
        }
    }
    get(name) {
        return this.tools.get(name);
    }
    has(name) {
        return this.tools.has(name);
    }
    getAll() {
        return Array.from(this.tools.values());
    }
    getDefinitions() {
        return this.getAll().map(({ registered, ...def }) => def);
    }
    get size() {
        return this.tools.size;
    }
    clear() {
        this.tools.clear();
    }
}
exports.ToolRegistry = ToolRegistry;
//# sourceMappingURL=ToolRegistry.js.map