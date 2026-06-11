"use strict";
/**
 * CurrentFileProvider — Active editor file resolution
 * KSA-252
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentFileProvider = void 0;
class CurrentFileProvider {
    context;
    constructor(context) {
        this.context = context;
    }
    getFileName() {
        try {
            return this.context.getActiveEditorPath();
        }
        catch {
            return null;
        }
    }
}
exports.CurrentFileProvider = CurrentFileProvider;
//# sourceMappingURL=CurrentFileProvider.js.map