/**
 * ErrorClassifier — classify tool execution errors as permanent vs transient.
 * KSA-139: Determines whether cache should be invalidated.
 */
export declare enum ErrorClass {
    PERMANENT = "permanent",
    TRANSIENT = "transient",
    SERVER_DISCONNECT = "server_disconnect"
}
/** Classify an error message into permanent, transient, or server_disconnect. */
export declare function classifyError(errorMessage: string): ErrorClass;
//# sourceMappingURL=error-classifier.d.ts.map