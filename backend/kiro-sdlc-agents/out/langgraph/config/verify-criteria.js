"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVerifyCriteria = getVerifyCriteria;
const VERIFY_CRITERIA = {
    requirements: {
        phase: "requirements",
        key: "brd_completeness",
        description: "BRD must have minimum required sections and user stories",
        checks: [
            "Contains at least 3 user stories with 'As a' pattern",
            "Each story has acceptance criteria",
            "Dependencies section is present",
            "Non-Functional Requirements section is present",
        ],
    },
    specification: {
        phase: "specification",
        key: "fsd_use_cases",
        description: "FSD must have complete use cases with flows",
        checks: [
            "Contains use cases with Main Flow tables",
            "Contains Alternative Flow and Exception Flow",
            "Business Rules table with BR- IDs exists",
            "Data Model section is present",
        ],
    },
    design: {
        phase: "design",
        key: "tdd_architecture",
        description: "TDD must have architecture and class design",
        checks: [
            "Architecture Overview section with diagram reference",
            "Class/Module Design with package structure",
            "Contains code blocks with implementation details",
            "Implementation Checklist is present",
        ],
    },
    test_planning: {
        phase: "test_planning",
        key: "stp_coverage",
        description: "STP must cover all BRD stories with traceability",
        checks: [
            "Requirements Traceability Matrix (RTM) is present",
            "All BRD story IDs appear in RTM",
            "Test cases have clear steps and expected results",
            "Multiple test levels defined (UT, IT, E2E)",
        ],
    },
    implementation: {
        phase: "implementation",
        key: "code_compiles",
        description: "Implementation must compile and pass basic validation",
        checks: [
            "No TypeScript compilation errors reported",
            "Key functions/classes defined as per TDD",
            "Exports are properly declared",
            "No obvious runtime errors in logic",
        ],
    },
    user_guide: {
        phase: "user_guide",
        key: "ug_sections",
        description: "User Guide must have required documentation sections",
        checks: [
            "Installation/Quick Start section exists",
            "Configuration Reference with tables exists",
            "Usage section with examples exists",
            "Troubleshooting section exists",
        ],
    },
};
/** Get verification criteria for a given phase. Returns null if not configured. */
function getVerifyCriteria(phase) {
    return VERIFY_CRITERIA[phase] ?? null;
}
//# sourceMappingURL=verify-criteria.js.map