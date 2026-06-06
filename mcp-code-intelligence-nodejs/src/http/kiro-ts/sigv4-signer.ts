/**
 * SigV4 Signer — KSA-237
 * AWS Signature Version 4 signing for Kiro AI API requests.
 * Uses Node.js built-in crypto module (zero external dependencies).
 */

import * as crypto from 'crypto';
import { AWSCredentials } from './types.js';

export interface SignedRequest {
  headers: Record<string, string>;
}

export interface SignOptions {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  credentials: AWSCredentials;
  region: string;
  service?: string;
  datetime?: string;
}

/**
 * Sign an HTTP request using AWS SigV4.
 * Returns additional headers to add to the request.
 */
export function signRequest(options: SignOptions): SignedRequest {
  const { method, url, headers, body, credentials, region, service = 'kiro' } = options;

  const parsedUrl = new URL(url);
  const datetime = options.datetime || getAmzDatetime();
  const date = datetime.substring(0, 8); // YYYYMMDD

  // Step 1: Create canonical request
  const canonicalUri = parsedUrl.pathname || '/';
  const canonicalQuerystring = parsedUrl.searchParams.toString();

  const headersToSign: Record<string, string> = {
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

  const result: Record<string, string> = {
    'Authorization': authorization,
    'x-amz-date': datetime,
    'x-amz-content-sha256': bodyHash,
  };

  if (credentials.sessionToken) {
    result['x-amz-security-token'] = credentials.sessionToken;
  }

  return { headers: result };
}

function getSigningKey(secretKey: string, date: string, region: string, service: string): Buffer {
  const kDate = hmac(`AWS4${secretKey}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  return kSigning;
}

function hmac(key: string | Buffer, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function hmacHex(key: Buffer, data: string): string {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest('hex');
}

function sha256Hex(data: string): string {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function getAmzDatetime(): string {
  const now = new Date();
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}
