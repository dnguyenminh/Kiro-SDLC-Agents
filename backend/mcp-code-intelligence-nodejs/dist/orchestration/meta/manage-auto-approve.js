"use strict";
/**
 * manage_auto_approve meta-tool — add/remove tools from auto-approve list.
 * Persists to .code-intel/auto-approve.json.
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
exports.MANAGE_AUTO_APPROVE_DEFINITION = void 0;
exports.executeManageAutoApprove = executeManageAutoApprove;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
exports.MANAGE_AUTO_APPROVE_DEFINITION = {
    name: 'manage_auto_approve',
    description: 'Add or remove tools from the auto-approve list (persists across restarts).',
    inputSchema: {
        type: 'object',
        properties: {
            tool_name: { type: 'string', description: 'Name of the tool to update' },
            server_name: { type: 'string', description: 'Name of the server (if updating all tools of a server)' },
            auto_approve: { type: 'boolean', description: 'Whether to add or remove from auto-approve list' },
        },
        required: ['auto_approve'],
    },
};
function executeManageAutoApprove(args, workspace) {
    const autoApprove = args.auto_approve;
    if (typeof autoApprove !== 'boolean') {
        return JSON.stringify({ error: "Missing 'auto_approve' (boolean)" });
    }
    const toolName = args.tool_name;
    const serverName = args.server_name;
    if (!toolName && !serverName) {
        return JSON.stringify({ error: "Provide 'tool_name' or 'server_name'" });
    }
    const target = toolName ?? `server:${serverName}`;
    const list = loadList(workspace);
    if (autoApprove) {
        list.add(target);
    }
    else {
        list.delete(target);
    }
    saveList(workspace, list);
    const action = autoApprove ? 'added to' : 'removed from';
    return JSON.stringify({ success: true, message: `'${target}' ${action} auto-approve list` });
}
function getFilePath(workspace) {
    const dir = path.join(workspace, '.code-intel');
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'auto-approve.json');
}
function loadList(workspace) {
    const filePath = getFilePath(workspace);
    if (!fs.existsSync(filePath))
        return new Set();
    try {
        const arr = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return new Set(arr);
    }
    catch {
        return new Set();
    }
}
function saveList(workspace, list) {
    const filePath = getFilePath(workspace);
    fs.writeFileSync(filePath, JSON.stringify([...list]), 'utf-8');
}
//# sourceMappingURL=manage-auto-approve.js.map