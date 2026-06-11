"use strict";
/**
 * SteeringProvider — .kiro/steering/ files reading
 * KSA-252
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
exports.SteeringProvider = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class SteeringProvider {
    steeringDir;
    constructor(workspaceRoot) {
        this.steeringDir = path.join(workspaceRoot, '.kiro', 'steering');
    }
    async getList() {
        try {
            const entries = fs.readdirSync(this.steeringDir);
            return entries.filter(e => e.endsWith('.md'));
        }
        catch {
            return [];
        }
    }
    async getContent(fileName) {
        const filePath = path.join(this.steeringDir, fileName);
        try {
            return fs.readFileSync(filePath, 'utf8');
        }
        catch {
            return `[Error: Cannot read ${fileName}]`;
        }
    }
}
exports.SteeringProvider = SteeringProvider;
//# sourceMappingURL=SteeringProvider.js.map