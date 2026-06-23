"use strict";
/**
 * SigV4 Signer — KSA-237
 * AWS Signature Version 4 signing for Kiro AI API requests.
 * Uses Node.js built-in crypto module (zero external dependencies).
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.signRequest = signRequest;
const crypto = __importStar(require("crypto"));
/**
 * Sign an HTTP request using AWS SigV4.
 * Returns additional headers to add to the request.
 */
function signRequest(options) {
    const { method, url, headers, body, credentials, region, service = 'kiro' } = options;
    const parsedUrl = new URL(url);
    const datetime = options.datetime || getAmzDatetime();
    const date = datetime.substring(0, 8); // YYYYMMDD
    // Step 1: Create canonical request
    const canonicalUri = parsedUrl.pathname || '/';
    const canonicalQuerystring = parsedUrl.searchParams.toString();
    const headersToSign = {
        host: parsedUrl.host,
        'content-type': headers['content-type'] || 'application/json',
        'x-amz-date': datetime,
    };
    if (credentials.sessionToken) {
        headersToSign['x-amz-security-token'] = credentials.sessionToken;
    }
    const signedHeaderKeys = Object.keys(headersToSign).sort();
    const signedHeaders = signedHeaderKeys.join(';');
    const canonicalHeaders = signedHeaderKeys
        .map(k => `${k}:${headersToSign[k]}\n`)
        .join('');
    const bodyHash = sha256Hex(body);
    const canonicalRequest = [
        method,
        canonicalUri,
        canonicalQuerystring,
        canonicalHeaders,
        signedHeaders,
        bodyHash,
    ].join('\n');
    // Step 2: Create string to sign
    const credentialScope = `${date}/${region}/${service}/aws4_request`;
    const stringToSign = [
        'AWS4-HMAC-SHA256',
        datetime,
        credentialScope,
        sha256Hex(canonicalRequest),
    ].join('\n');
    // Step 3: Calculate signing key
    const signingKey = getSigningKey(credentials.secretAccessKey, date, region, service);
    // Step 4: Calculate signature
    const signature = hmacHex(signingKey, stringToSign);
    // Step 5: Build Authorization header
    const authorization = `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    const result = {
        'Authorization': authorization,
        'x-amz-date': datetime,
        'x-amz-content-sha256': bodyHash,
    };
    if (credentials.sessionToken) {
        result['x-amz-security-token'] = credentials.sessionToken;
    }
    return { headers: result };
}
function getSigningKey(secretKey, date, region, service) {
    const kDate = hmac(`AWS4${secretKey}`, date);
    const kRegion = hmac(kDate, region);
    const kService = hmac(kRegion, service);
    const kSigning = hmac(kService, 'aws4_request');
    return kSigning;
}
function hmac(key, data) {
    return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}
function hmacHex(key, data) {
    return crypto.createHmac('sha256', key).update(data, 'utf8').digest('hex');
}
function sha256Hex(data) {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}
function getAmzDatetime() {
    const now = new Date();
    return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}
//# sourceMappingURL=sigv4-signer.js.map