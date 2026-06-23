"use strict";
/**
 * QaNode — KSA-210, KSA-242
 * QA Engineer agent node. Handles test planning (STP/STC creation)
 * and test execution phases.
 * KSA-242: Added template refs, steering injection, KB ingest, diagram requirements.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QaNode = void 0;
const base_node_1 = require("./base-node");
const steering_loader_1 = require("../steering-loader");
/** Template paths for QA documents */
const QA_TEMPLATES = {
    STP: "documents/templates/STP-TEMPLATE.md",
    STC: "documents/templates/STC-TEMPLATE.md",
    TEST_REPORT: "documents/templates/TEST-REPORT-TEMPLATE.md",
};
const QA_SYSTEM_PROMPT_FALLBACK = `You are a QA Engineer agent for an SDLC pipeline.
Your responsibilities vary by phase:

TEST PLANNING (Phase 4):
- Create STP (Software Test Plan) with 6 test levels: PBT, UT, IT, E2E-API, E2E-UI, SIT
- Create STC (Software Test Cases) with detailed test cases per level
- Build RTM (Requirements Traceability Matrix) ensuring 100% BRD coverage
- Generate test data CSV files for automation
- Follow the provided template structure EXACTLY

TESTING (Phase 6):
- Execute automated tests (run ./gradlew test)
- Review test code quality (verify IT tests use real integrations)
- Report test results with pass/fail counts
- Verify UG accuracy (Phase 5.5)
- Use TEST-REPORT template for reporting

DIAGRAM RULES (MANDATORY for test planning):
- MUST create draw.io diagrams: test-coverage.drawio + test-execution-flow.drawio
- All diagrams stored at documents/{TICKET}/diagrams/
- Each diagram has both .drawio (source) and .png (rendered)
- XML must start with <mxGraphModel>, NOT <mxfile>
- Include Diagram Index table in appendix

Always produce complete, production-ready documents in Markdown format.`;
class QaNode extends base_node_1.BaseNode {
    async execute(state) {
        const phase = state.currentPhase;
        if (phase === "test_planning") {
            return this.executeTestPlanning(state);
        }
        else if (phase === "testing") {
            return this.executeTestExecution(state);
        }
        else if (phase === "user_guide") {
            return this.executeUgVerification(state);
        }
        // Default: test planning
        return this.executeTestPlanning(state);
    }
    async executeTestPlanning(state) {
        this.streamHandler.emitToken(this.nodeId, `[QA] Creating STP/STC for ${state.ticketKey}...`, state.currentStreamId);
        const llmAvailable = await this.isLlmAvailable();
        let result;
        if (llmAvailable) {
            // --- Step 1: Read BRD/FSD/TDD from KB and files ---
            this.streamHandler.emitToken(this.nodeId, `  → Step 1: Reading context...`, state.currentStreamId);
            let kbContext = "";
            try {
                kbContext = await this.kbSearch(`${state.ticketKey} BRD FSD TDD requirements`);
            }
            catch { /* */ }
            const brdContent = await this.readWorkspaceFile(state.documents.brd?.path || `documents/${state.ticketKey}/BRD.md`) || "";
            const fsdContent = await this.readWorkspaceFile(state.documents.fsd?.path || `documents/${state.ticketKey}/FSD.md`) || "";
            const tddContent = await this.readWorkspaceFile(state.documents.tdd?.path || `documents/${state.ticketKey}/TDD.md`) || "";
            // --- Step 2: Read templates ---
            this.streamHandler.emitToken(this.nodeId, `  → Step 2: Reading templates...`, state.currentStreamId);
            const stpTemplate = await this.readWorkspaceFile(QA_TEMPLATES.STP) || "[STP template not found]";
            const stcTemplate = await this.readWorkspaceFile(QA_TEMPLATES.STC) || "[STC template not found]";
            // --- Step 3: Generate via LLM ---
            this.streamHandler.emitToken(this.nodeId, `  → Step 3: Generating STP/STC...`, state.currentStreamId);
            const userPrompt = `Create STP and STC for ticket ${state.ticketKey}.

## STP TEMPLATE\n\n${stpTemplate}

## STC TEMPLATE\n\n${stcTemplate}

## BRD (for RTM coverage)\n\n${brdContent.slice(0, 10000)}

## FSD (for use cases)\n\n${fsdContent.slice(0, 10000)}

## TDD (for technical test cases)\n\n${tddContent.slice(0, 10000)}

${kbContext ? `## KB CONTEXT\n\n${kbContext}` : ""}

Requirements:
- 6 test levels: PBT, UT, IT, E2E-API, E2E-UI, SIT
- RTM with 100% coverage of BRD user stories
- Test data CSV files for each test case

DIAGRAMS (MANDATORY):
- documents/${state.ticketKey}/diagrams/test-coverage.drawio + .png
- documents/${state.ticketKey}/diagrams/test-execution-flow.drawio + .png
- Include Diagram Index table`;
            const workspaceRoot = this.getWorkspaceRoot();
            let systemPrompt = await this.loadAgentPrompt("qa-agent", QA_SYSTEM_PROMPT_FALLBACK);
            if (workspaceRoot) {
                const rules = await (0, steering_loader_1.loadSteeringRules)(workspaceRoot, "langgraph");
                systemPrompt = (0, steering_loader_1.injectSteering)(systemPrompt, rules);
            }
            result = await this.callLlmStreamFull(systemPrompt, userPrompt, state);
            // --- Step 4: Write files ---
            this.streamHandler.emitToken(this.nodeId, `  → Step 4: Writing STP.md + STC.md...`, state.currentStreamId);
            await this.writeWorkspaceFile(`documents/${state.ticketKey}/STP.md`, result);
            // --- Step 5: Export DOCX ---
            this.streamHandler.emitToken(this.nodeId, `  → Step 5: Exporting DOCX...`, state.currentStreamId);
            const ver = (state.documents.stp?.version || 0) + 1;
            await this.exportDocx(`documents/${state.ticketKey}/STP.md`, `STP-v${ver}-${state.ticketKey}`);
            // --- Step 6: KB ingest ---
            this.streamHandler.emitToken(this.nodeId, `  → Step 6: KB ingest...`, state.currentStreamId);
            await this.kbIngestFile(`documents/${state.ticketKey}/STP.md`, "DOCUMENT");
            this.streamHandler.emitToken(this.nodeId, `  ✅ STP/STC pipeline complete`, state.currentStreamId);
        }
        else {
            result = await this.callMcp("invoke_sub_agent", {
                name: "qa-agent",
                prompt: `Tao STP va STC cho ${state.ticketKey}. PHAI tao draw.io diagrams (test-coverage.drawio + test-execution-flow.drawio) va export PNG.`,
            });
        }
        const output = {
            nodeId: this.nodeId,
            content: result,
            timestamp: new Date().toISOString(),
            metadata: { phase: "test_planning", docType: "STP/STC", usedLlm: llmAvailable, kbIngested: true },
        };
        const documents = { ...state.documents };
        documents.stp = {
            status: "done",
            version: (documents.stp?.version || 0) + 1,
            path: `documents/${state.ticketKey}/STP.md`,
            completedAt: new Date().toISOString(),
        };
        documents.stc = {
            status: "done",
            version: (documents.stc?.version || 0) + 1,
            path: `documents/${state.ticketKey}/STC.md`,
            completedAt: new Date().toISOString(),
        };
        return {
            agentOutputs: [output],
            documents,
        };
    }
    async executeTestExecution(state) {
        this.streamHandler.emitToken(this.nodeId, `[QA] Executing tests for ${state.ticketKey}...`, state.currentStreamId);
        const llmAvailable = await this.isLlmAvailable();
        let result;
        if (llmAvailable) {
            // Read test report template
            const reportTemplate = await this.readWorkspaceFile(QA_TEMPLATES.TEST_REPORT) || "";
            const userPrompt = `Execute automated tests for ${state.ticketKey}.

TEST REPORT TEMPLATE:\n\n${reportTemplate}

Run ./gradlew test and report results. Review IT test quality.
Verify tests use real integrations (not all-mock).
Report pass/fail counts per test level.
Generate TEST-REPORT.md following the template.
Output: documents/${state.ticketKey}/TEST-REPORT-${state.ticketKey}.md`;
            const workspaceRoot = this.getWorkspaceRoot();
            let systemPrompt = await this.loadAgentPrompt("qa-agent", QA_SYSTEM_PROMPT_FALLBACK);
            if (workspaceRoot) {
                const rules = await (0, steering_loader_1.loadSteeringRules)(workspaceRoot, "langgraph");
                systemPrompt = (0, steering_loader_1.injectSteering)(systemPrompt, rules);
            }
            result = await this.callLlmStreamFull(systemPrompt, userPrompt, state);
            // Write test report
            await this.writeWorkspaceFile(`documents/${state.ticketKey}/TEST-REPORT-${state.ticketKey}.md`, result);
            // Export DOCX
            await this.exportDocx(`documents/${state.ticketKey}/TEST-REPORT-${state.ticketKey}.md`, `TEST-REPORT-${state.ticketKey}`);
            // KB ingest
            await this.kbIngestFile(`documents/${state.ticketKey}/TEST-REPORT-${state.ticketKey}.md`, "DOCUMENT");
        }
        else {
            result = await this.callMcp("invoke_sub_agent", {
                name: "qa-agent",
                prompt: `Chay automated tests cho ${state.ticketKey}. Run ./gradlew test. Bao cao pass/fail. Dung template: ${QA_TEMPLATES.TEST_REPORT}`,
            });
        }
        const output = {
            nodeId: this.nodeId,
            content: result,
            timestamp: new Date().toISOString(),
            metadata: { phase: "testing", action: "test_execution", usedLlm: llmAvailable, kbIngested: true },
        };
        return {
            agentOutputs: [output],
        };
    }
    async executeUgVerification(state) {
        this.streamHandler.emitToken(this.nodeId, `[QA] Verifying User Guide for ${state.ticketKey}...`, state.currentStreamId);
        const result = await this.callMcp("invoke_sub_agent", {
            name: "qa-agent",
            prompt: `Verify User Guide cho ${state.ticketKey}. Follow instructions, report PASS/FAIL per step.`,
        });
        const output = {
            nodeId: this.nodeId,
            content: result,
            timestamp: new Date().toISOString(),
            metadata: { phase: "user_guide", action: "ug_verification" },
        };
        return {
            agentOutputs: [output],
            parallelResults: { qa_ug: result },
        };
    }
}
exports.QaNode = QaNode;
//# sourceMappingURL=qa-node.js.map