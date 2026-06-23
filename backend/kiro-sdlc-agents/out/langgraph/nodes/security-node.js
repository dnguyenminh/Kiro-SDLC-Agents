"use strict";
/**
 * SecurityNode — KSA-210, KSA-242
 * Security review agent node. Performs security analysis on
 * design documents and implementation code.
 * KSA-242: Added template ref, steering injection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityNode = void 0;
const base_node_1 = require("./base-node");
const steering_loader_1 = require("../steering-loader");
/** Template path for Security Report */
const SECURITY_REPORT_TEMPLATE = "documents/templates/SECURITY-REPORT-TEMPLATE.md";
const SECURITY_SYSTEM_PROMPT_FALLBACK = `You are a Security Engineer agent for an SDLC pipeline.
Your role is to review designs and code for security vulnerabilities.

Review areas:
- Authentication and authorization design
- Input validation and sanitization
- SQL injection, XSS, CSRF prevention
- Secrets management (no hardcoded credentials)
- API security (rate limiting, CORS, JWT handling)
- Data encryption (at rest and in transit)
- Dependency vulnerabilities (known CVEs)
- OWASP Top 10 compliance
- Least privilege principle
- Secure error handling (no information leakage)

Report findings with severity (Critical/High/Medium/Low) and remediation steps.
Follow the provided Security Report template structure.`;
class SecurityNode extends base_node_1.BaseNode {
    async execute(state) {
        this.streamHandler.emitToken(this.nodeId, `[Security] Reviewing security for ${state.ticketKey}...`, state.currentStreamId);
        const llmAvailable = await this.isLlmAvailable();
        let result;
        if (llmAvailable) {
            const userPrompt = `Perform security review for ${state.ticketKey}.

TEMPLATE: ${SECURITY_REPORT_TEMPLATE}

TDD: ${state.documents.tdd?.path || "documents/" + state.ticketKey + "/TDD.md"}
FSD: ${state.documents.fsd?.path || "documents/" + state.ticketKey + "/FSD.md"}

Review the design for:
1. Authentication/Authorization gaps
2. Input validation completeness
3. Injection vulnerabilities (SQL, XSS, command)
4. Secrets management approach
5. API security (rate limits, CORS, tokens)
6. Data protection (encryption, PII handling)
7. Error handling (no info leakage)
8. Dependency security

Report each finding with:
- Severity: Critical/High/Medium/Low
- Location: which section/component
- Description: what the issue is
- Remediation: how to fix`;
            // KSA-242: Inject steering rules
            const workspaceRoot = require("vscode").workspace.workspaceFolders?.[0]?.uri.fsPath;
            let systemPrompt = await this.loadAgentPrompt("security-agent", SECURITY_SYSTEM_PROMPT_FALLBACK);
            if (workspaceRoot) {
                const rules = await (0, steering_loader_1.loadSteeringRules)(workspaceRoot, "langgraph");
                systemPrompt = (0, steering_loader_1.injectSteering)(systemPrompt, rules);
            }
            result = await this.callLlmStreamFull(systemPrompt, userPrompt, state);
        }
        else {
            result = await this.callMcp("invoke_sub_agent", {
                name: "security-agent",
                prompt: `Security review cho ${state.ticketKey}. Review TDD va code. Report findings. Template: ${SECURITY_REPORT_TEMPLATE}`,
            });
        }
        const output = {
            nodeId: this.nodeId,
            content: result,
            timestamp: new Date().toISOString(),
            metadata: { phase: state.currentPhase, action: "security_review", usedLlm: llmAvailable },
        };
        return {
            agentOutputs: [output],
        };
    }
}
exports.SecurityNode = SecurityNode;
//# sourceMappingURL=security-node.js.map