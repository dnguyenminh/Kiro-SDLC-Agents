/**
 * KSA-191: Salesforce Metadata Parser.
 * Extracts symbols and relationships from Salesforce metadata XML files.
 * Supports: Flows, Custom Objects, Fields, LWC metadata, Aura metadata.
 * Uses regex-based XML extraction (no tree-sitter — wasmPath is null).
 */
export default class SalesforceMetaParser {
    languageId;
    constructor(_parser, languageId) {
        // _parser is null — this parser does not use tree-sitter
        this.languageId = languageId;
    }
    getSupportedExtensions() {
        return ['.flow-meta.xml', '.object-meta.xml', '.field-meta.xml',
            '.js-meta.xml', '.component-meta.xml'];
    }
    parse(source, filePath) {
        const symbols = [];
        const relationships = [];
        const errors = [];
        try {
            const metaType = this.detectMetaType(filePath);
            switch (metaType) {
                case 'flow':
                    this.parseFlow(source, filePath, symbols, relationships);
                    break;
                case 'object':
                    this.parseObject(source, filePath, symbols, relationships);
                    break;
                case 'field':
                    this.parseField(source, filePath, symbols, relationships);
                    break;
                case 'lwc-meta':
                    this.parseLWCMeta(source, filePath, symbols, relationships);
                    break;
                case 'aura-meta':
                    this.parseAuraMeta(source, filePath, symbols);
                    break;
                default:
                    break;
            }
        }
        catch (err) {
            errors.push({
                message: `XML parse error: ${err instanceof Error ? err.message : String(err)}`,
                line: 1,
                column: 0,
            });
        }
        return { symbols, relationships, errors };
    }
    // --- Metadata Type Detection ---
    detectMetaType(filePath) {
        const normalized = filePath.replace(/\\/g, '/').toLowerCase();
        if (normalized.endsWith('.flow-meta.xml'))
            return 'flow';
        if (normalized.endsWith('.object-meta.xml'))
            return 'object';
        if (normalized.endsWith('.field-meta.xml'))
            return 'field';
        if (normalized.endsWith('.js-meta.xml'))
            return 'lwc-meta';
        if (normalized.endsWith('.component-meta.xml'))
            return 'aura-meta';
        return null;
    }
    // --- Flow Parsing ---
    parseFlow(source, filePath, symbols, relationships) {
        const flowName = this.nameFromPath(filePath);
        const processType = this.extractXmlValues(source, 'processType')[0] ?? 'Flow';
        const lineCount = source.split('\n').length;
        symbols.push({
            name: flowName,
            kind: 'class',
            filePath,
            startLine: 1,
            endLine: lineCount,
            signature: `Flow: ${flowName} (${processType})`,
            modifiers: [processType.toLowerCase()],
            isExported: true,
        });
        // Extract variables as properties
        const variables = this.extractXmlBlocks(source, 'variables');
        for (const varBlock of variables) {
            const varName = this.extractXmlValues(varBlock, 'name')[0];
            const dataType = this.extractXmlValues(varBlock, 'dataType')[0] ?? 'String';
            if (varName) {
                symbols.push({
                    name: varName,
                    kind: 'property',
                    filePath,
                    startLine: 1,
                    endLine: 1,
                    signature: `${varName}: ${dataType}`,
                    parentName: flowName,
                    returnType: dataType,
                    isExported: false,
                });
            }
        }
        // Extract decisions as methods
        const decisions = this.extractXmlBlocks(source, 'decisions');
        for (const block of decisions) {
            const name = this.extractXmlValues(block, 'name')[0];
            if (name) {
                symbols.push({
                    name,
                    kind: 'method',
                    filePath,
                    startLine: 1,
                    endLine: 1,
                    signature: `Decision: ${name}`,
                    parentName: flowName,
                    isExported: false,
                });
            }
        }
        // Extract actionCalls — Apex invocations
        const actions = this.extractXmlBlocks(source, 'actionCalls');
        for (const block of actions) {
            const actionName = this.extractXmlValues(block, 'name')[0];
            const actionType = this.extractXmlValues(block, 'actionType')[0];
            if (actionName) {
                symbols.push({
                    name: actionName,
                    kind: 'method',
                    filePath,
                    startLine: 1,
                    endLine: 1,
                    signature: `Action: ${actionName} (${actionType ?? 'unknown'})`,
                    parentName: flowName,
                    isExported: false,
                });
                // If Apex action, create 'calls' relationship
                if (actionType === 'apex') {
                    const className = this.extractXmlValues(block, 'actionName')[0];
                    if (className) {
                        relationships.push({
                            sourceSymbol: flowName,
                            targetSymbol: className,
                            kind: 'calls',
                            filePath,
                            line: 1,
                            metadata: { actionType: 'apex' },
                        });
                    }
                }
            }
        }
        // Extract referenced SObjects from recordLookups, recordCreates, etc.
        for (const tag of ['recordLookups', 'recordCreates', 'recordUpdates', 'recordDeletes']) {
            const blocks = this.extractXmlBlocks(source, tag);
            for (const block of blocks) {
                const objectName = this.extractXmlValues(block, 'object')[0];
                if (objectName) {
                    relationships.push({
                        sourceSymbol: flowName,
                        targetSymbol: objectName,
                        kind: 'uses',
                        filePath,
                        line: 1,
                        metadata: { operation: tag.replace('record', '').toLowerCase() },
                    });
                }
            }
        }
    }
    // --- Object Parsing ---
    parseObject(source, filePath, symbols, relationships) {
        const objectName = this.nameFromPath(filePath);
        const lineCount = source.split('\n').length;
        symbols.push({
            name: objectName,
            kind: 'class',
            filePath,
            startLine: 1,
            endLine: lineCount,
            signature: `CustomObject: ${objectName}`,
            modifiers: ['custom-object'],
            isExported: true,
        });
        // Extract fields
        const fields = this.extractXmlBlocks(source, 'fields');
        for (const block of fields) {
            const fieldName = this.extractXmlValues(block, 'fullName')[0];
            const fieldType = this.extractXmlValues(block, 'type')[0] ?? 'Text';
            if (fieldName) {
                symbols.push({
                    name: fieldName,
                    kind: 'property',
                    filePath,
                    startLine: 1,
                    endLine: 1,
                    signature: `${fieldName}: ${fieldType}`,
                    parentName: objectName,
                    returnType: fieldType,
                    isExported: true,
                });
                // Lookup/MasterDetail relationships
                if (fieldType === 'Lookup' || fieldType === 'MasterDetail') {
                    const referenceTo = this.extractXmlValues(block, 'referenceTo')[0];
                    if (referenceTo) {
                        relationships.push({
                            sourceSymbol: objectName,
                            targetSymbol: referenceTo,
                            kind: 'uses',
                            filePath,
                            line: 1,
                            metadata: { relationType: fieldType },
                        });
                    }
                }
            }
        }
        // Extract validation rules
        const validations = this.extractXmlBlocks(source, 'validationRules');
        for (const block of validations) {
            const ruleName = this.extractXmlValues(block, 'fullName')[0];
            if (ruleName) {
                symbols.push({
                    name: ruleName,
                    kind: 'method',
                    filePath,
                    startLine: 1,
                    endLine: 1,
                    signature: `ValidationRule: ${ruleName}`,
                    parentName: objectName,
                    isExported: false,
                });
            }
        }
    }
    // --- Field Parsing (standalone .field-meta.xml) ---
    parseField(source, filePath, symbols, relationships) {
        const fieldName = this.nameFromPath(filePath);
        const fieldType = this.extractXmlValues(source, 'type')[0] ?? 'Text';
        const parentObject = this.inferObjectFromFieldPath(filePath);
        const lineCount = source.split('\n').length;
        symbols.push({
            name: fieldName,
            kind: 'property',
            filePath,
            startLine: 1,
            endLine: lineCount,
            signature: `${fieldName}: ${fieldType}`,
            parentName: parentObject,
            returnType: fieldType,
            isExported: true,
        });
        if (fieldType === 'Lookup' || fieldType === 'MasterDetail') {
            const referenceTo = this.extractXmlValues(source, 'referenceTo')[0];
            if (referenceTo && parentObject) {
                relationships.push({
                    sourceSymbol: parentObject,
                    targetSymbol: referenceTo,
                    kind: 'uses',
                    filePath,
                    line: 1,
                    metadata: { relationType: fieldType, field: fieldName },
                });
            }
        }
    }
    // --- LWC Metadata Parsing ---
    parseLWCMeta(source, filePath, symbols, relationships) {
        const componentName = this.nameFromPath(filePath);
        const lineCount = source.split('\n').length;
        // Check if exposed
        const isExposed = this.extractXmlValues(source, 'isExposed')[0] === 'true';
        // Extract targets
        const targets = this.extractXmlValues(source, 'target');
        symbols.push({
            name: componentName,
            kind: 'class',
            filePath,
            startLine: 1,
            endLine: lineCount,
            signature: `LWC: ${componentName}`,
            modifiers: isExposed ? ['exposed'] : [],
            isExported: isExposed,
        });
        // Extract wire adapters — @wire relationships
        const wireBlocks = this.extractXmlBlocks(source, 'targetConfig');
        // Also check for datasource references
        const datasources = this.extractXmlValues(source, 'datasource');
        for (const ds of datasources) {
            if (ds) {
                relationships.push({
                    sourceSymbol: componentName,
                    targetSymbol: ds,
                    kind: 'wire',
                    filePath,
                    line: 1,
                    metadata: { type: 'datasource' },
                });
            }
        }
    }
    // --- Aura Metadata Parsing ---
    parseAuraMeta(source, filePath, symbols) {
        const componentName = this.nameFromPath(filePath);
        const lineCount = source.split('\n').length;
        symbols.push({
            name: componentName,
            kind: 'class',
            filePath,
            startLine: 1,
            endLine: lineCount,
            signature: `AuraComponent: ${componentName}`,
            modifiers: ['aura'],
            isExported: true,
        });
    }
    // --- XML Extraction Helpers ---
    /** Extract XML element text content by tag name. */
    extractXmlValues(source, tagName) {
        const regex = new RegExp(`<${tagName}>([^<]*)</${tagName}>`, 'g');
        const results = [];
        let match;
        while ((match = regex.exec(source)) !== null) {
            results.push(match[1]);
        }
        return results;
    }
    /** Extract XML blocks (multi-line elements). */
    extractXmlBlocks(source, tagName) {
        const regex = new RegExp(`<${tagName}>[\\s\\S]*?</${tagName}>`, 'g');
        const results = [];
        let match;
        while ((match = regex.exec(source)) !== null) {
            results.push(match[0]);
        }
        return results;
    }
    /** Extract component name from file path. */
    nameFromPath(filePath) {
        const normalized = filePath.replace(/\\/g, '/');
        const basename = normalized.split('/').pop() ?? normalized;
        // Remove all meta extensions: .flow-meta.xml -> name
        return basename
            .replace(/\.(flow|object|field|js|component)-meta\.xml$/, '')
            .replace(/\.\w+$/, '');
    }
    /** Infer parent object from field path. */
    inferObjectFromFieldPath(filePath) {
        const normalized = filePath.replace(/\\/g, '/');
        // Pattern: .../objects/{ObjectName}/fields/{FieldName}.field-meta.xml
        const match = normalized.match(/objects\/([^/]+)\/fields\//);
        return match ? match[1] : null;
    }
}
//# sourceMappingURL=salesforce-meta-parser.js.map