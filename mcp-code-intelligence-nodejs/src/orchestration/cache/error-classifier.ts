/**
 * ErrorClassifier — classify tool execution errors as permanent vs transient.
 * KSA-139: Determines whether cache should be invalidated.
 */

export enum ErrorClass {
  PERMANENT = 'permanent',
  TRANSIENT = 'transient',
  SERVER_DISCONNECT = 'server_disconnect',
}

/** Patterns indicating permanent errors (tool is gone/broken). */
const PERMANENT_PATTERNS = [
  /tool not found/i,
  /unknown tool/i,
  /schema mismatch/i,
  /permission denied/i,
  /forbidden/i,
  /not authorized/i,
  /invalid tool/i,
  /no such tool/i,
];

/** Patterns indicating transient errors (retry may succeed). */
const TRANSIENT_PATTERNS = [
  /timeout/i,
  /timed out/i,
  /ETIMEDOUT/i,
  /ECONNREFUSED/i,
  /ECONNRESET/i,
  /network/i,
  /rate limit/i,
  /too many requests/i,
  /429/,
  /503/,
  /502/,
  /temporarily unavailable/i,
];

/** Patterns indicating server-level disconnect. */
const DISCONNECT_PATTERNS = [
  /server disconnected/i,
  /server stopped/i,
  /process exited/i,
  /EPIPE/i,
  /broken pipe/i,
];

/** Classify an error message into permanent, transient, or server_disconnect. */
export function classifyError(errorMessage: string): ErrorClass {
  for (const pattern of DISCONNECT_PATTERNS) {
    if (pattern.test(errorMessage)) return ErrorClass.SERVER_DISCONNECT;
  }
  for (const pattern of TRANSIENT_PATTERNS) {
    if (pattern.test(errorMessage)) return ErrorClass.TRANSIENT;
  }
  for (const pattern of PERMANENT_PATTERNS) {
    if (pattern.test(errorMessage)) return ErrorClass.PERMANENT;
  }
  // Default: treat unknown errors as transient (fail-safe, don't invalidate)
  return ErrorClass.TRANSIENT;
}
