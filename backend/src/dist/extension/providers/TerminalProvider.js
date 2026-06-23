"use strict";
/**
 * TerminalProvider — Terminal output capture
 * KSA-252
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerminalProvider = void 0;
class TerminalProvider {
    context;
    constructor(context) {
        this.context = context;
    }
    getOutput(lines) {
        try {
            return this.context.getTerminalOutput(lines || 100);
        }
        catch {
            return '[No terminal output available]';
        }
    }
}
exports.TerminalProvider = TerminalProvider;
//# sourceMappingURL=TerminalProvider.js.map