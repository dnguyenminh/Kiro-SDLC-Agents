"use strict";
/**
 * KSA-162: Framework Detector — Identifies frameworks from import statements.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FrameworkDetector = void 0;
class FrameworkDetector {
    registry;
    constructor(registry) {
        this.registry = registry;
    }
    /** Detect framework from file source code (import analysis). */
    detect(source, language) {
        const frameworks = this.registry.getFrameworksForLanguage(language);
        if (frameworks.length === 0)
            return null;
        let bestMatch = null;
        for (const { name, patterns } of frameworks) {
            let score = 0;
            for (const importPattern of patterns.imports) {
                if (source.includes(importPattern)) {
                    score++;
                }
            }
            if (score > 0 && (!bestMatch || score > bestMatch.score)) {
                bestMatch = { name, score };
            }
        }
        if (!bestMatch)
            return null;
        return {
            name: bestMatch.name,
            language,
            confidence: bestMatch.score >= 2 ? 'High' : 'Medium',
        };
    }
    /** Detect framework from a list of import strings (from relationships table). */
    detectFromImports(imports, language) {
        const frameworks = this.registry.getFrameworksForLanguage(language);
        if (frameworks.length === 0)
            return null;
        for (const { name, patterns } of frameworks) {
            for (const importPattern of patterns.imports) {
                if (imports.some(imp => imp.includes(importPattern))) {
                    return { name, language, confidence: 'High' };
                }
            }
        }
        return null;
    }
}
exports.FrameworkDetector = FrameworkDetector;
//# sourceMappingURL=FrameworkDetector.js.map