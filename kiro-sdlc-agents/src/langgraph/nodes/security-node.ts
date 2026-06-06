/**
 * SecurityNode — KSA-210
 * Security review agent node. Performs security analysis on
 * design documents and implementation code.
 */

import { BaseNode } from "./base-node";
import { PipelineState, AgentOutput } from "../state";

const SECURITY_SYSTEM_PROMPT = `You are a Security Engineer agent for an SDLC pipeline.
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

Report findings with severity (Critical/High/Medium/Low) and remediation steps.`;

export class SecurityNode extends BaseNode {
  async execute(state: PipelineState): Promise<Partial<PipelineState>> {
    this.streamHandler.emitToken(
      this.nodeId,
      `[Security] Reviewing security for ${state.ticketKey}...`,
      state.currentStreamId
    );

    const llmAvailable = await this.isLlmAvailable();
    let result: string;

    if (llmAvailable) {
      const userPrompt = `Perform security review for ${state.ticketKey}.

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

      result = await this.callLlmStreamFull(SECURITY_SYSTEM_PROMPT, userPrompt, state);
    } else {
      result = await this.callMcp("invoke_sub_agent", {
        name: "security-agent",
        prompt: `Security review cho ${state.ticketKey}. Review TDD va code. Report findings.`,
      });
    }

    const output: AgentOutput = {
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
