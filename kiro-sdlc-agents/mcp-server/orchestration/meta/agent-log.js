"use strict";
/**
 * agent_log meta-tool — logs agent activity to .code-intel/agent-log.jsonl.
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
exports.AGENT_LOG_DEFINITION = void 0;
exports.executeAgentLog = executeAgentLog;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
exports.AGENT_LOG_DEFINITION = {
    name: 'agent_log',
    description: 'Write an execution log entry for agent activity tracking.',
    inputSchema: {
        type: 'object',
        properties: {
            ticket_key: { type: 'string', description: 'Jira ticket key (e.g. MTO-12)' },
            agent_name: { type: 'string', description: 'Agent: SM, BA, TA, SA, QA, DEV, DEVOPS' },
            step: { type: 'string', description: 'Step ID (e.g. Step-1, Self-Check)' },
            status: { type: 'string', description: 'START|DONE|ARTIFACT|SKIP|ERROR|WARN|VERIFY' },
            message: { type: 'string', description: 'What happened' },
            artifacts: { type: 'string', description: 'Optional JSON of artifact paths' },
        },
        required: ['ticket_key', 'agent_name', 'step', 'status', 'message'],
    },
};
function executeAgentLog(args, workspace) {
    const ticketKey = args.ticket_key ?? '';
    const agentName = args.agent_name ?? '';
    const step = args.step ?? '';
    const status = args.status ?? '';
    const message = args.message ?? '';
    const artifacts = args.artifacts;
    if (!ticketKey || !agentName || !status) {
        return JSON.stringify({ error: 'ticket_key, agent_name, status are required' });
    }
    const entry = {
        timestamp: new Date().toISOString(),
        ticket_key: ticketKey,
        agent_name: agentName,
        step,
        status,
        message,
    };
    if (artifacts)
        entry.artifacts = artifacts;
    const logDir = path.join(workspace, '.code-intel');
    if (!fs.existsSync(logDir))
        fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'agent-log.jsonl'), JSON.stringify(entry) + '\n');
    return JSON.stringify({ success: true, logged: `${ticketKey}/${agentName}/${step}/${status}` });
}
//# sourceMappingURL=agent-log.js.map