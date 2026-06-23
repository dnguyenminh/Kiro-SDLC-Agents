"use strict";
/**
 * IndexingService — Upload documents and source files to remote backend for indexing.
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
exports.IndexingService = void 0;
const vscode = __importStar(require("vscode"));
class IndexingService {
    httpClient;
    constructor(httpClient) {
        this.httpClient = httpClient;
    }
    /**
     * Index markdown/document files.
     */
    async indexDocuments() {
        const files = await vscode.workspace.findFiles("**/*.md", "{node_modules,dist,.git,build,out}/**");
        return this.uploadFiles(files, "/api/index/documents");
    }
    /**
     * Index source code files.
     */
    async indexSource() {
        const files = await vscode.workspace.findFiles("**/*.{ts,js,kt,java,py,go,rs,tsx,jsx}", "{node_modules,dist,.git,build,out}/**");
        return this.uploadFiles(files, "/api/index/source");
    }
    async uploadFiles(files, endpoint) {
        const maxSize = 1_000_000; // 1MB limit per file
        const batch = [];
        for (const file of files.slice(0, 500)) {
            const stat = await vscode.workspace.fs.stat(file);
            if (stat.size > maxSize) {
                continue;
            }
            const content = await vscode.workspace.fs.readFile(file);
            const relativePath = vscode.workspace.asRelativePath(file);
            batch.push({
                path: relativePath,
                content: Buffer.from(content).toString("utf-8"),
            });
        }
        const result = await this.httpClient.post(endpoint, { files: batch }, 600000);
        return result;
    }
}
exports.IndexingService = IndexingService;
//# sourceMappingURL=IndexingService.js.map