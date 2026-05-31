"use strict";
/**
 * KSA-166: IDOR Detector — Detects Insecure Direct Object Reference vulnerabilities.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IDORDetector = void 0;
const TaintAnalyzer_js_1 = require("../taint/TaintAnalyzer.js");
/** Patterns indicating a parameter is an object ID. */
const ID_PARAM_PATTERNS = [
    /id$/i, /Id$/, /_id$/i, /Id\b/, /uuid/i, /key$/i, /slug/i,
    /params\.id/, /params\.\w+Id/, /params\.\w+_id/,
];
/** Patterns indicating a database lookup. */
const DB_LOOKUP_PATTERNS = [
    'findById(', 'findOne(', 'findByPk(', 'get(', '.find(',
    'findUnique(', 'findFirst(', 'getOne(', 'load(',
    'SELECT', 'WHERE', 'query(',
];
/** Patterns indicating authorization/ownership check. */
const AUTHZ_PATTERNS = [
    'owner', 'user_id', 'userId', 'createdBy', 'belongsTo',
    'canAccess', 'isOwner', 'hasPermission', 'authorize',
    'checkAccess', 'verifyOwnership', 'req.user.id',
    'currentUser', 'session.user',
];
class IDORDetector {
    taintAnalyzer;
    constructor(taintAnalyzer) {
        this.taintAnalyzer = taintAnalyzer ?? new TaintAnalyzer_js_1.TaintAnalyzer();
    }
    /** Detect IDOR in a handler function. */
    detect(functionNode, filePath, language, handlerName) {
        const findings = [];
        const bodyText = functionNode.text;
        // Step 1: Find ID parameters
        const idParams = this.findIDParams(functionNode);
        if (idParams.length === 0)
            return [];
        // Step 2: For each ID param, check if there's a DB lookup
        for (const param of idParams) {
            const dbLookup = this.findDBLookup(bodyText, param);
            if (!dbLookup)
                continue;
            // Step 3: Check if there's an authorization check between param and lookup
            const hasAuthz = this.hasAuthorizationCheck(bodyText, param);
            if (!hasAuthz) {
                const trustTier = this.classifyTrustTier(bodyText, param);
                findings.push({
                    handler: handlerName,
                    filePath,
                    idParam: param,
                    dbLookup,
                    missingAuthzCheck: true,
                    trustTier,
                    confidence: trustTier === 'T1' ? 90 : trustTier === 'T2' ? 70 : 50,
                    cwe: 'CWE-639',
                    severity: trustTier === 'T1' ? 'High' : 'Medium',
                });
            }
        }
        return findings;
    }
    /** Find parameters that look like object IDs. */
    findIDParams(functionNode) {
        const params = [];
        const text = functionNode.text;
        for (const pattern of ID_PARAM_PATTERNS) {
            const matches = text.match(new RegExp(pattern.source, 'g'));
            if (matches) {
                for (const match of matches) {
                    if (!params.includes(match))
                        params.push(match);
                }
            }
        }
        return params;
    }
    /** Find database lookup using the ID parameter. */
    findDBLookup(bodyText, param) {
        for (const pattern of DB_LOOKUP_PATTERNS) {
            const idx = bodyText.indexOf(pattern);
            if (idx !== -1) {
                // Check if the param is used near the lookup
                const context = bodyText.slice(Math.max(0, idx - 50), idx + 100);
                if (context.includes(param) || this.isNearby(bodyText, idx, param)) {
                    const line = bodyText.slice(0, idx).split('\n').length;
                    return { function: pattern.replace('(', ''), line };
                }
            }
        }
        return null;
    }
    /** Check if there's an authorization check for the given parameter. */
    hasAuthorizationCheck(bodyText, param) {
        for (const pattern of AUTHZ_PATTERNS) {
            if (bodyText.includes(pattern))
                return true;
        }
        return false;
    }
    /** Classify trust tier based on directness. */
    classifyTrustTier(bodyText, param) {
        // T1: param goes directly to DB lookup (no intermediate processing)
        const lines = bodyText.split('\n');
        let paramLine = -1;
        let lookupLine = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(param) && paramLine === -1)
                paramLine = i;
            if (DB_LOOKUP_PATTERNS.some(p => lines[i].includes(p)))
                lookupLine = i;
        }
        if (paramLine >= 0 && lookupLine >= 0) {
            const distance = Math.abs(lookupLine - paramLine);
            if (distance <= 2)
                return 'T1';
            if (distance <= 5)
                return 'T2';
        }
        return 'T3';
    }
    isNearby(text, idx, param) {
        const window = text.slice(Math.max(0, idx - 200), idx + 200);
        return window.includes(param);
    }
}
exports.IDORDetector = IDORDetector;
//# sourceMappingURL=IDORDetector.js.map