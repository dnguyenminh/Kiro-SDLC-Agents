/**
 * Extension configuration — component definitions and paths.
 */

export interface Component {
    id: string;
    label: string;
    description: string;
    sourcePath: string;
    targetPath: string;
    filter?: string[];
}

export const CORE_COMPONENTS: Component[] = [
    {
        id: "agents",
        label: "Agents (BA, SA, QA, DEV, DevOps, UI, Security, SM, TA)",
        description: "Multi-agent SDLC pipeline with prompts",
        sourcePath: ".kiro/agents",
        targetPath: ".kiro/agents"
    },
    {
        id: "steering",
        label: "Steering Rules",
        description: "Code standards, self-learning, file-writing, drawio, jira-workflow",
        sourcePath: ".kiro/steering",
        targetPath: ".kiro/steering"
    },
    {
        id: "hooks",
        label: "Hooks (Code Index + Drawio Validation)",
        description: "Auto-trigger hooks for file events",
        sourcePath: ".kiro/hooks",
        targetPath: ".kiro/hooks"
    },
    {
        id: "templates",
        label: "Document Templates (BRD, FSD, TDD, STP, STC, DPG, RLN, UG)",
        description: "Templates for all SDLC documents",
        sourcePath: "documents/templates",
        targetPath: "documents/templates"
    }
];

export const INDEXER_BASE: Component = {
    id: "indexer-config",
    label: "Code Intelligence — Config (always included)",
    description: "index-config.json + output folder structure",
    sourcePath: ".analysis/code-intelligence",
    targetPath: ".analysis/code-intelligence",
    filter: ["index-config.json", "modules", "scripts/README.md"]
};

export const INDEXER_OPTIONS: Component[] = [
    {
        id: "indexer-python",
        label: "Python Indexer (recommended — zero dependency)",
        description: "Python 3.7+ standard library only",
        sourcePath: ".analysis/code-intelligence/scripts/python",
        targetPath: ".analysis/code-intelligence/scripts/python"
    },
    {
        id: "indexer-java",
        label: "Java Indexer",
        description: "Java 17+ (for JVM projects)",
        sourcePath: ".analysis/code-intelligence/scripts/java",
        targetPath: ".analysis/code-intelligence/scripts/java"
    },
    {
        id: "indexer-powershell",
        label: "PowerShell Indexer",
        description: "PowerShell 5.1+ (Windows built-in)",
        sourcePath: ".analysis/code-intelligence/scripts/powershell",
        targetPath: ".analysis/code-intelligence/scripts/powershell"
    },
    {
        id: "indexer-bash",
        label: "Bash Indexer",
        description: "Bash 4+ (Linux/Mac built-in)",
        sourcePath: ".analysis/code-intelligence/scripts/bash",
        targetPath: ".analysis/code-intelligence/scripts/bash"
    },
    {
        id: "indexer-nodejs",
        label: "Node.js Indexer (most accurate)",
        description: "Node.js 18+ (needs npm install)",
        sourcePath: ".analysis/code-intelligence/scripts/nodejs",
        targetPath: ".analysis/code-intelligence/scripts/nodejs"
    }
];

export const INDEXER_SCRIPTS = {
    python: { check: "python --version", label: "Python" },
    java: { check: "java --version", label: "Java" },
    nodejs: { check: "node --version", label: "Node.js" },
    powershell: { check: "powershell -Command \"$PSVersionTable.PSVersion\"", label: "PowerShell" },
    bash: { check: "bash --version", label: "Bash" }
};
