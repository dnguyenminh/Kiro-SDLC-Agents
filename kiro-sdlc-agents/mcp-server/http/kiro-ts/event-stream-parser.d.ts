/**
 * AWS Event Stream Parser — KSA-237
 *
 * Parses the binary AWS Event Stream frames returned by
 * `q.{region}.amazonaws.com/generateAssistantResponse`.
 *
 * Ported from kiro.rs `src/kiro/parser/` (crc.rs, frame.rs, header.rs, decoder.rs).
 *
 * Frame layout (all integers big-endian):
 *   [total_length(4)] [header_length(4)] [prelude_crc(4)] [headers...] [payload...] [message_crc(4)]
 *   - prelude_crc  = CRC32 of the first 8 bytes
 *   - message_crc  = CRC32 of the whole message except the last 4 bytes
 */
export declare function crc32(buf: Buffer, start?: number, end?: number): number;
export type HeaderValue = boolean | number | string | bigint | Buffer;
export interface Headers {
    [name: string]: HeaderValue;
}
export declare class ParseError extends Error {
    constructor(message: string);
}
export interface Frame {
    headers: Headers;
    payload: Buffer;
}
export declare function messageType(frame: Frame): string | undefined;
export declare function eventType(frame: Frame): string | undefined;
export declare function exceptionType(frame: Frame): string | undefined;
export declare function errorCode(frame: Frame): string | undefined;
/**
 * Try to parse a single frame from the buffer.
 * Returns the frame plus number of bytes consumed, or null if more data is needed.
 */
export declare function parseFrame(buffer: Buffer): {
    frame: Frame;
    consumed: number;
} | null;
export declare class EventStreamDecoder {
    private readonly maxErrors;
    private buffer;
    private errorCount;
    private stopped;
    constructor(maxErrors?: number);
    /** Append incoming bytes to the internal buffer. */
    feed(chunk: Buffer): void;
    /**
     * Decode all complete frames currently available in the buffer.
     * Tolerant: on a parse error it skips bytes/frames and continues, up to maxErrors.
     */
    decodeAll(): Frame[];
    /** Attempt fault recovery by skipping a corrupted frame or a single byte. */
    private recover;
    isStopped(): boolean;
}
//# sourceMappingURL=event-stream-parser.d.ts.map