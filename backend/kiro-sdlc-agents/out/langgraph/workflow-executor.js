"use strict";
/**
 * WorkflowExecutor — KSA-243
 * Executes parsed workflow steps from agent .md files dynamically.
 * Maps each ActionType to BaseNode utility methods.
 *
 * Usage in nodes:
 *   const executor = new WorkflowExecutor(this); // pass BaseNode instance
 *   const result = await executor.run("ba-agent", state, { docType: "BRD" });
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowExecutor = void 0;
const workflow_parser_1 = require("./workflow-parser");
const steering_loader_1 = require("./steering-loader");
class WorkflowExecutor {
    node;
    constructor(node) {
        this.node = node;
    }
    /**
     * Run a complete agent workflow dynamically.
     */
    async run(agentName, state, vars = {}) {
        const agentContent = await this.node.readWorkspaceFile(`.kiro/agents/${agentName}.md`);
        if (!agentContent) {
            throw new Error(`Agent file not found: .kiro/agents/${agentName}.md`);
        }
        const workflow = (0, workflow_parser_1.parseAgentWorkflow)(agentName, agentContent);
        const skillContent = await this.loadSkills(workflow.skills);
        const ctx = {
            ticketKey: state.ticketKey,
            docType: vars.docType,
            templateContent: "",
            jiraContext: "",
            kbContext: "",
            codeIntelContext: "",
            skillContent,
            generatedContent: "",
            outputPath: vars.outputPath || `documents/${state.ticketKey}/`,
            ...vars,
        };
        this.emitStatus(`[${agentName}] Executing ${workflow.steps.length} steps dynamically...`, state);
        for (const step of workflow.steps) {
            if (step.isConditional && step.condition) {
                if (!this.evaluateCondition(step.condition, ctx)) {
                    this.emitStatus(`  skip ${step.id}: ${step.title}`, state);
                    continue;
                }
            }
            this.emitStatus(`  -> ${step.id}: ${step.title}`, state);
            for (const action of step.actions) {
                await this.executeAction(action, ctx, state, workflow.rolePrompt);
            }
        }
        return ctx.generatedContent;
    }
    async executeAction(action, ctx, state, rolePrompt) {
        const ticketKey = ctx.ticketKey;
        try {
            switch (action.type) {
                case "read_template": {
                    const path = this.resolvePath(action.params.path || "", ctx);
                    const content = await this.node.readWorkspaceFile(path);
                    if (content)
                        ctx.templateContent = content;
                    break;
                }
                case "read_file": {
                    const path = this.resolvePath(action.params.path || "", ctx);
                    const content = await this.node.readWorkspaceFile(path);
                    if (content) {
                        const key = path.split("/").pop()?.replace(/\.\w+$/, "") || "file";
                        ctx[key] = content;
                    }
                    break;
                }
                case "fetch_jira": {
                    try {
                        ctx.jiraContext = await this.node.getJiraIssue(ticketKey);
                    }
                    catch {
                        ctx.jiraContext = "[Jira unavailable]";
                    }
                    break;
                }
                case "fetch_jira_recursive": {
                    try {
                        ctx.jiraContext = await this.node.getJiraIssueRecursive(ticketKey, 2, 10);
                    }
                    catch {
                        ctx.jiraContext = "[Jira unavailable]";
                    }
                    break;
                }
                case "kb_search": {
                    try {
                        const query = (action.params.query || `${ticketKey} context`)
                            .replace(/\{TICKET-KEY\}/g, ticketKey).replace(/\{TICKET\}/g, ticketKey);
                        ctx.kbContext += "\n" + await this.node.kbSearch(query);
                    }
                    catch { /* */ }
                    break;
                }
                case "kb_ingest": {
                    await this.node.kbIngest(ctx.generatedContent.slice(0, 5000), "DOCUMENT", `workflow-${ctx.docType || "doc"}`, [ticketKey, ctx.docType || "document", "langgraph"]);
                    break;
                }
                case "kb_ingest_file": {
                    const path = this.resolvePath(action.params.path || ctx.outputPath, ctx);
                    await this.node.kbIngestFile(path);
                    break;
                }
                case "read_code_intelligence": {
                    ctx.codeIntelContext = await this.node.readCodeIntelligence() || "";
                    break;
                }
                case "generate_llm": {
                    const userPrompt = this.buildLlmPrompt(ctx, state);
                    const workspaceRoot = this.node.getWorkspaceRoot();
                    let systemPrompt = rolePrompt + (ctx.skillContent ? "\n\n" + ctx.skillContent : "");
                    if (workspaceRoot) {
                        const rules = await (0, steering_loader_1.loadSteeringRules)(workspaceRoot, "langgraph");
                        systemPrompt = (0, steering_loader_1.injectSteering)(systemPrompt, rules);
                    }
                    ctx.generatedContent = await this.node.callLlmStreamFull(systemPrompt, userPrompt, state);
                    break;
                }
                case "write_file": {
                    const path = this.resolvePath(action.params.path || ctx.outputPath, ctx);
                    if (ctx.generatedContent)
                        await this.node.writeWorkspaceFile(path, ctx.generatedContent);
                    break;
                }
                case "append_file": {
                    const path = this.resolvePath(action.params.path || ctx.outputPath, ctx);
                    if (ctx.generatedContent)
                        await this.node.appendWorkspaceFile(path, ctx.generatedContent);
                    break;
                }
                case "export_docx": {
                    const docxName = `${ctx.docType || "DOC"}-v1-${ticketKey}`;
                    await this.node.exportDocx(ctx.outputPath, docxName);
                    break;
                }
                case "export_drawio_png": {
                    const drawioPath = action.params.path || `documents/${ticketKey}/diagrams/`;
                    await this.node.exportDrawioPng(drawioPath);
                    break;
                }
                case "exec_shell": {
                    const command = (action.params.command || "")
                        .replace(/\{TICKET-KEY\}/g, ticketKey).replace(/\{TICKET\}/g, ticketKey);
                    if (command) {
                        try {
                            await this.node.execShell(command);
                        }
                        catch { /* */ }
                    }
                    break;
                }
                case "exec_git": {
                    const args = (action.params.args || "")
                        .replace(/\{TICKET-KEY\}/g, ticketKey).replace(/\{TICKET\}/g, ticketKey);
                    if (args) {
                        try {
                            await this.node.execGit(args);
                        }
                        catch { /* */ }
                    }
                    break;
                }
                case "discover_tools": {
                    await this.node.discoverTools("get issue details project tracker");
                    await this.node.discoverTools("search knowledge base");
                    break;
                }
                case "load_skill": {
                    const path = action.params.path || "";
                    if (path) {
                        const content = await this.node.readWorkspaceFile(path);
                        if (content)
                            ctx.skillContent += "\n\n" + content;
                    }
                    break;
                }
                default: break;
            }
        }
        catch { /* Individual action failure is non-blocking */ }
    }
    buildLlmPrompt(ctx, state) {
        const sections = [];
        sections.push(`Create ${ctx.docType || "document"} for ticket ${ctx.ticketKey}.`);
        if (ctx.templateContent)
            sections.push(`\n## TEMPLATE\n\n${ctx.templateContent}`);
        if (ctx.jiraContext && !ctx.jiraContext.includes("unavailable")) {
            sections.push(`\n## JIRA DATA\n\n${ctx.jiraContext.slice(0, 15000)}`);
        }
        if (ctx.kbContext.trim())
            sections.push(`\n## KB CONTEXT\n\n${ctx.kbContext.slice(0, 5000)}`);
        if (ctx.codeIntelContext)
            sections.push(`\n## CODE INTELLIGENCE\n\n${ctx.codeIntelContext.slice(0, 8000)}`);
        const chatContext = state.chatHistory?.filter(m => m.role === "user").map(m => m.content).join("\n");
        if (chatContext)
            sections.push(`\n## USER REQUIREMENTS\n\n${chatContext}`);
        return sections.join("\n");
    }
    async loadSkills(skillPaths) {
        const contents = [];
        for (const path of skillPaths) {
            const content = await this.node.readWorkspaceFile(path);
            if (content) {
                const fmMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
                contents.push(fmMatch ? fmMatch[1].trim() : content.trim());
            }
        }
        return contents.join("\n\n---\n\n");
    }
    resolvePath(path, ctx) {
        return path.replace(/\{TICKET-KEY\}/g, ctx.ticketKey).replace(/\{TICKET\}/g, ctx.ticketKey);
    }
    evaluateCondition(condition, ctx) {
        const lower = condition.toLowerCase();
        if (lower.includes("fsd") && ctx.docType !== "FSD")
            return false;
        if (lower.includes("brd") && ctx.docType !== "BRD")
            return false;
        return true;
    }
    emitStatus(message, state) {
        this.node.streamHandler.emitToken(this.node.nodeId, message, state.currentStreamId);
    }
}
exports.WorkflowExecutor = WorkflowExecutor;
//# sourceMappingURL=workflow-executor.js.map