"use strict";
/**
 * SFDX project detection utility.
 * Detects sfdx-project.json and resolves package directories.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SfdxDetector = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class SfdxDetector {
    /**
     * Detect SFDX project at given path.
     * Checks for sfdx-project.json at root and one level deep.
     */
    detect(searchPath) {
        // Check root
        if (this.isValidSfdxProject(searchPath)) {
            return this.buildProject(searchPath);
        }
        // Check one level deep
        try {
            const entries = fs.readdirSync(searchPath, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory() && !entry.name.startsWith('.')) {
                    const dirPath = path.join(searchPath, entry.name);
                    if (this.isValidSfdxProject(dirPath)) {
                        return this.buildProject(dirPath);
                    }
                }
            }
        }
        catch {
            // Directory not readable
        }
        return null;
    }
    /**
     * Check if path contains a valid SFDX project.
     */
    isValidSfdxProject(projectPath) {
        const configPath = path.join(projectPath, 'sfdx-project.json');
        return fs.existsSync(configPath);
    }
    /**
     * Extract package directories from sfdx-project.json config.
     */
    getPackageDirectories(config) {
        if (!config || !Array.isArray(config.packageDirectories)) {
            return ['force-app'];
        }
        return config.packageDirectories.map((pd) => pd.path ?? pd).filter(Boolean);
    }
    buildProject(root) {
        try {
            const configPath = path.join(root, 'sfdx-project.json');
            const configContent = fs.readFileSync(configPath, 'utf-8');
            const config = JSON.parse(configContent);
            return {
                root,
                config,
                packageDirectories: this.getPackageDirectories(config),
            };
        }
        catch {
            return null;
        }
    }
}
exports.SfdxDetector = SfdxDetector;
//# sourceMappingURL=sfdx-detector.js.map