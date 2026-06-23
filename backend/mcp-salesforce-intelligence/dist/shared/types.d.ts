/**
 * Shared TypeScript interfaces for mcp-salesforce-intelligence module.
 */
export type MetadataType = 'ApexClass' | 'ApexTrigger' | 'ApexInterface' | 'ApexEnum' | 'Flow' | 'CustomObject' | 'CustomField' | 'LWC' | 'Permission' | 'Label' | 'Layout' | 'Other';
export type RelationType = 'extends' | 'implements' | 'references' | 'dml' | 'soql' | 'calls' | 'imports' | 'triggers';
export interface GraphNode {
    id: string;
    type: MetadataType;
    label: string;
    file_path: string;
}
export interface GraphEdge {
    source: string;
    target: string;
    relationship: RelationType;
}
export interface DependencyResult {
    node: string;
    node_type: MetadataType;
    dependencies: Array<{
        name: string;
        type: MetadataType;
        relationship: RelationType;
        depth: number;
    }>;
    circular_refs: string[];
    total_count: number;
}
export interface ImpactResult {
    node: string;
    total_impacted: number;
    direct_impact: Array<{
        name: string;
        type: MetadataType;
        relationship: RelationType;
    }>;
    indirect_impact: Array<{
        name: string;
        type: MetadataType;
        depth: number;
        path: string[];
    }>;
    by_type: Record<string, number>;
    circular_refs: string[];
}
export interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: object;
}
export interface SfError {
    error: string;
    message: string;
}
export interface IndexState {
    version: number;
    project_path: string;
    last_indexed: string;
    total_files: number;
    files: Record<string, FileHashEntry>;
}
export interface FileHashEntry {
    hash: string;
    indexed_at: string;
    type: MetadataType;
    name: string;
}
export interface GraphCacheData {
    version: number;
    built_at: string;
    nodes: GraphNode[];
    edges: GraphEdge[];
}
export interface KBPayload {
    content: string;
    type: 'CONTEXT';
    tags: string;
    summary: string;
}
export interface KBResult {
    content: string;
    tags: string;
    score: number;
}
export interface ApexParseResult {
    file_path: string;
    type: 'class' | 'interface' | 'enum' | 'trigger';
    name: string;
    modifiers: string[];
    parent_class: string | null;
    interfaces: string[];
    methods: ApexMethod[];
    properties: ApexProperty[];
    inner_classes: string[];
    dependencies: ApexDependencies;
    trigger_info: TriggerInfo | null;
    errors: ParseError[];
}
export interface ApexMethod {
    name: string;
    modifiers: string[];
    return_type: string;
    parameters: Array<{
        name: string;
        type: string;
    }>;
    body?: string;
}
export interface ApexProperty {
    name: string;
    type: string;
    modifiers: string[];
}
export interface ApexDependencies {
    referenced_classes: string[];
    dml_operations: string[];
    soql_queries: string[];
    method_calls: string[];
}
export interface TriggerInfo {
    object: string;
    events: string[];
}
export interface ParseError {
    line: number;
    column: number;
    message: string;
}
export interface FlowParseResult {
    file_path: string;
    name: string;
    type: string;
    status: string;
    elements: FlowElement[];
    variables: FlowVariable[];
    dependencies: FlowDependencies;
    errors: ParseError[];
}
export interface FlowElement {
    name: string;
    type: string;
    label: string;
    connector?: string;
}
export interface FlowVariable {
    name: string;
    type: string;
    is_input: boolean;
    is_output: boolean;
}
export interface FlowDependencies {
    referenced_objects: string[];
    referenced_classes: string[];
    referenced_flows: string[];
}
export interface ObjectParseResult {
    file_path: string;
    name: string;
    label: string;
    fields: ObjectField[];
    relationships: ObjectRelationship[];
    validation_rules: string[];
    triggers: string[];
    errors: ParseError[];
}
export interface ObjectField {
    name: string;
    type: string;
    label: string;
    required: boolean;
}
export interface ObjectRelationship {
    name: string;
    type: 'Lookup' | 'MasterDetail' | 'Hierarchical';
    related_to: string;
}
export interface LWCParseResult {
    file_path: string;
    name: string;
    js_file: string | null;
    html_file: string | null;
    css_file: string | null;
    imports: LWCImport[];
    public_properties: LWCProperty[];
    wire_adapters: string[];
    apex_calls: string[];
    child_components: string[];
    events: LWCEvent[];
    dependencies: LWCDependencies;
    errors: ParseError[];
}
export interface LWCImport {
    source: string;
    specifiers: string[];
}
export interface LWCProperty {
    name: string;
    type: string;
    decorator: string;
}
export interface LWCEvent {
    name: string;
    type: 'dispatch' | 'handle';
}
export interface LWCDependencies {
    apex_classes: string[];
    wire_adapters: string[];
    child_components: string[];
    custom_labels: string[];
}
export interface ProjectScanResult {
    project_path: string;
    sfdx_config: any;
    package_directories: string[];
    components: ProjectComponent[];
    summary: {
        apex_classes: number;
        apex_triggers: number;
        flows: number;
        objects: number;
        lwc_components: number;
        other: number;
        total: number;
    };
}
export interface ProjectComponent {
    name: string;
    type: MetadataType;
    file_path: string;
}
export interface ChangeSet {
    added: string[];
    modified: string[];
    deleted: string[];
    unchanged: string[];
}
export interface FileInfo {
    path: string;
    hash: string;
}
export interface SfdxProject {
    root: string;
    config: any;
    packageDirectories: string[];
}
//# sourceMappingURL=types.d.ts.map