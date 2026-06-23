/**
 * WorkflowParser — KSA-243
 * Parses .kiro/agents/{agent}.md workflow sections into executable step definitions.
 * Each step maps to a concrete action (readFile, kbSearch, callLlm, writeFile, etc.)
 *
 * Parsing rules:
 * - Steps are identified by "### Step N:" headings
 * - Within steps, numbered items are sub-actions
 * - Action type is inferred from keywords in the text
 * - contextFiles references (`.kiro/steering/*.md`) become skill activations
 */

export interface ParsedWorkflow {
  agentName: string;
  rolePrompt: string;          // Identity + rules (non-step content)
  steps: WorkflowStep[];
  skills: string[];            // Referenced steering/skill files to load
}

export interface WorkflowStep {
  id: string;                  // e.g., "step-1", "step-7.5"
  title: string;               // Heading text
  actions: StepAction[];
  isConditional: boolean;      // Has "if" / "when" / "only for" modifiers
  condition?: string;          // e.g., "only for FSD"
}

export type ActionType =
  | "read_template"
  | "read_file"
  | "fetch_jira"
  | "fetch_jira_recursive"
  | "kb_search"
  | "kb_ingest"
  | "kb_ingest_file"
  | "read_code_intelligence"
  | "generate_llm"
  | "write_file"
  | "append_file"
  | "export_docx"
  | "export_drawio_png"
  | "exec_shell"
  | "exec_git"
  | "discover_tools"
  | "load_skill"
  | "stream_status"
  | "validate"
  | "unknown";

export interface StepAction {
  type: ActionType;
  description: string;         // Original text for context
  params: Record<string, string>; // Extracted parameters
}

// === Keyword to Action mapping ===

const ACTION_PATTERNS: Array<{ pattern: RegExp; type: ActionType; paramExtractor?: (match: RegExpMatchArray, line: string) => Record<string, string> }> = [
  {
    pattern: /read.*template|template.*read/i,
    type: "read_template",
    paramExtractor: (_m, line) => ({ path: extractPath(line) || "documents/templates/" }),
  },
  {
    pattern: /readFile|read\s+.*\.(md|txt|yml|yaml|json|kt|ts)/i,
    type: "read_file",
    paramExtractor: (_m, line) => ({ path: extractPath(line) || "" }),
  },
  {
    pattern: /fetch.*jira.*recursive|linked.*ticket.*recursive/i,
    type: "fetch_jira_recursive",
  },
  {
    pattern: /fetch.*ticket|get.*issue|jira.*ticket/i,
    type: "fetch_jira",
  },
  {
    pattern: /mem_search|kb.*search|knowledge.*base.*search|search.*KB/i,
    type: "kb_search",
    paramExtractor: (_m, line) => ({ query: extractQuoted(line) || "" }),
  },
  {
    pattern: /mem_ingest_file|ingest.*file.*KB/i,
    type: "kb_ingest_file",
    paramExtractor: (_m, line) => ({ path: extractPath(line) || "" }),
  },
  {
    pattern: /mem_ingest|ingest.*KB|KB.*ingest|knowledge.*base.*ingest/i,
    type: "kb_ingest",
  },
  {
    pattern: /code.?intelligence|\.analysis\/code-intelligence/i,
    type: "read_code_intelligence",
  },
  {
    pattern: /generate.*BRD|generate.*FSD|generate.*TDD|generate.*document|create.*document|LLM.*generat/i,
    type: "generate_llm",
  },
  {
    pattern: /stream_write_file|write.*file|create.*at.*documents\//i,
    type: "write_file",
    paramExtractor: (_m, line) => ({ path: extractPath(line) || "" }),
  },
  {
    pattern: /export_docx|export.*DOCX|MS\s*Word/i,
    type: "export_docx",
  },
  {
    pattern: /export.*PNG|draw\.io.*export|drawio_export_png/i,
    type: "export_drawio_png",
  },
  {
    pattern: /executePwsh|exec.*shell|run.*command|npm.*run|gradlew/i,
    type: "exec_shell",
    paramExtractor: (_m, line) => ({ command: extractCommand(line) || "" }),
  },
  {
    pattern: /git\s+(checkout|add|commit|push|branch)/i,
    type: "exec_git",
    paramExtractor: (_m, line) => ({ args: extractGitArgs(line) || "" }),
  },
  {
    pattern: /find_tools|discover.*tools/i,
    type: "discover_tools",
  },
  {
    pattern: /\.kiro\/steering\/.*\.md|contextFiles|load.*skill/i,
    type: "load_skill",
    paramExtractor: (_m, line) => ({ path: extractSteeringPath(line) || "" }),
  },
];

/**
 * Parse an agent markdown file into a structured workflow.
 */
export function parseAgentWorkflow(agentName: string, markdown: string): ParsedWorkflow {
  // Strip front-matter
  const fmMatch = markdown.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
  const body = fmMatch ? fmMatch[1].trim() : markdown.trim();

  const lines = body.split("\n");
  const steps: WorkflowStep[] = [];
  const roleLines: string[] = [];
  const skills = new Set<string>();

  let currentStep: WorkflowStep | null = null;
  let inWorkflowSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect step heading: "### Step N:" or "### Step N.N:"
    const stepMatch = line.match(/^###\s*Step\s+([\d.]+):?\s*(.*)/i);
    if (stepMatch) {
      if (currentStep) steps.push(currentStep);

      const stepId = `step-${stepMatch[1]}`;
      const title = stepMatch[2].trim();

      currentStep = {
        id: stepId,
        title,
        actions: [],
        isConditional: /\(if|only\s+for|when\s+/i.test(title),
        condition: extractCondition(title),
      };
      inWorkflowSection = true;
      continue;
    }

    // Detect "## Workflow" section start
    if (/^##\s*Workflow/i.test(line)) {
      inWorkflowSection = true;
      continue;
    }

    // Detect new ## heading (exits workflow section)
    if (/^##\s+/.test(line) && !/^###/.test(line) && inWorkflowSection && currentStep) {
      steps.push(currentStep);
      currentStep = null;
      inWorkflowSection = false;
    }

    // Process content within a step
    if (currentStep && inWorkflowSection) {
      const actions = inferActions(line);
      for (const action of actions) {
        currentStep.actions.push(action);
      }

      const skillMatch = line.match(/\.kiro\/steering\/([\w-]+\.md)/);
      if (skillMatch) {
        skills.add(`.kiro/steering/${skillMatch[1]}`);
      }
    } else if (!inWorkflowSection) {
      roleLines.push(line);
    }
  }

  if (currentStep) steps.push(currentStep);

  // Extract skills from contextFiles references
  const contextFilesMatches = body.matchAll(/contextFiles.*?path.*?["']([^"']+)["']/g);
  for (const m of contextFilesMatches) {
    skills.add(m[1]);
  }

  return {
    agentName,
    rolePrompt: roleLines.join("\n").trim(),
    steps,
    skills: [...skills],
  };
}

/**
 * Infer action type from a single line of text.
 */
function inferActions(line: string): StepAction[] {
  const actions: StepAction[] = [];
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("<!--") || trimmed === "---") return actions;

  for (const { pattern, type, paramExtractor } of ACTION_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      actions.push({
        type,
        description: trimmed,
        params: paramExtractor ? paramExtractor(match, trimmed) : {},
      });
      return actions;
    }
  }

  return actions;
}

// === Helper extractors ===

function extractPath(line: string): string | null {
  const match = line.match(/[`"']?((?:documents|\.analysis|\.kiro)\/[^\s`"',)]+)[`"']?/);
  return match ? match[1] : null;
}

function extractQuoted(line: string): string | null {
  const match = line.match(/["']([^"']+)["']/);
  return match ? match[1] : null;
}

function extractCommand(line: string): string | null {
  const match = line.match(/`([^`]+)`/) || line.match(/(?:run|execute)\s+(.+)/i);
  return match ? match[1].trim() : null;
}

function extractGitArgs(line: string): string | null {
  const match = line.match(/git\s+(.+)/i);
  return match ? match[1].trim() : null;
}

function extractSteeringPath(line: string): string | null {
  const match = line.match(/(\.kiro\/steering\/[\w-]+\.md)/);
  return match ? match[1] : null;
}

function extractCondition(title: string): string | undefined {
  const match = title.match(/\((?:if|only\s+for|when)\s+([^)]+)\)/i);
  return match ? match[1] : undefined;
}
