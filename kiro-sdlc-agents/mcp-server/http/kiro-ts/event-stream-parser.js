"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventStreamDecoder = exports.ParseError = void 0;
exports.crc32 = crc32;
exports.messageType = messageType;
exports.eventType = eventType;
exports.exceptionType = exceptionType;
exports.errorCode = errorCode;
exports.parseFrame = parseFrame;
const PRELUDE_SIZE = 12;
const MIN_MESSAGE_SIZE = PRELUDE_SIZE + 4;
const MAX_MESSAGE_SIZE = 16 * 1024 * 1024; // 16MB
const DEFAULT_MAX_ERRORS = 5;
// ---------------------------------------------------------------------------
// CRC32 (ISO-HDLC / zip / ethernet, polynomial 0xEDB88320)
// ---------------------------------------------------------------------------
const CRC32_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c >>> 0;
    }
    return table;
})();
function crc32(buf, start = 0, end = buf.length) {
    let crc = 0xffffffff;
    for (let i = start; i < end; i++) {
        crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}
var HeaderValueType;
(function (HeaderValueType) {
    HeaderValueType[HeaderValueType["BoolTrue"] = 0] = "BoolTrue";
    HeaderValueType[HeaderValueType["BoolFalse"] = 1] = "BoolFalse";
    HeaderValueType[HeaderValueType["Byte"] = 2] = "Byte";
    HeaderValueType[HeaderValueType["Short"] = 3] = "Short";
    HeaderValueType[HeaderValueType["Integer"] = 4] = "Integer";
    HeaderValueType[HeaderValueType["Long"] = 5] = "Long";
    HeaderValueType[HeaderValueType["ByteArray"] = 6] = "ByteArray";
    HeaderValueType[HeaderValueType["String"] = 7] = "String";
    HeaderValueType[HeaderValueType["Timestamp"] = 8] = "Timestamp";
    HeaderValueType[HeaderValueType["Uuid"] = 9] = "Uuid";
})(HeaderValueType || (HeaderValueType = {}));
class ParseError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ParseError';
    }
}
exports.ParseError = ParseError;
function parseHeaders(data, headerLength) {
    const headers = {};
    let offset = 0;
    while (offset < headerLength) {
        if (offset >= data.length)
            break;
        const nameLen = data[offset];
        offset += 1;
        if (nameLen === 0) {
            throw new ParseError('Header name length cannot be 0');
        }
        if (offset + nameLen > data.length) {
            throw new ParseError('Incomplete header name');
        }
        const name = data.toString('utf8', offset, offset + nameLen);
        offset += nameLen;
        if (offset >= data.length) {
            throw new ParseError('Incomplete header value type');
        }
        const valueType = data[offset];
        offset += 1;
        switch (valueType) {
            case HeaderValueType.BoolTrue:
                headers[name] = true;
                break;
            case HeaderValueType.BoolFalse:
                headers[name] = false;
                break;
            case HeaderValueType.Byte:
                ensureBytes(data, offset, 1);
                headers[name] = data.readInt8(offset);
                offset += 1;
                break;
            case HeaderValueType.Short:
                ensureBytes(data, offset, 2);
                headers[name] = data.readInt16BE(offset);
                offset += 2;
                break;
            case HeaderValueType.Integer:
                ensureBytes(data, offset, 4);
                headers[name] = data.readInt32BE(offset);
                offset += 4;
                break;
            case HeaderValueType.Long:
                ensureBytes(data, offset, 8);
                headers[name] = data.readBigInt64BE(offset);
                offset += 8;
                break;
            case HeaderValueType.Timestamp:
                ensureBytes(data, offset, 8);
                headers[name] = data.readBigInt64BE(offset);
                offset += 8;
                break;
            case HeaderValueType.ByteArray: {
                ensureBytes(data, offset, 2);
                const len = data.readUInt16BE(offset);
                offset += 2;
                ensureBytes(data, offset, len);
                headers[name] = data.subarray(offset, offset + len);
                offset += len;
                break;
            }
            case HeaderValueType.String: {
                ensureBytes(data, offset, 2);
                const len = data.readUInt16BE(offset);
                offset += 2;
                ensureBytes(data, offset, len);
                headers[name] = data.toString('utf8', offset, offset + len);
                offset += len;
                break;
            }
            case HeaderValueType.Uuid:
                ensureBytes(data, offset, 16);
                headers[name] = data.subarray(offset, offset + 16);
                offset += 16;
                break;
            default:
                throw new ParseError(`Invalid header value type: ${valueType}`);
        }
    }
    return headers;
}
function ensureBytes(data, offset, needed) {
    if (offset + needed > data.length) {
        throw new ParseError(`Incomplete header value: need ${needed} bytes at offset ${offset}`);
    }
}
function messageType(frame) {
    const v = frame.headers[':message-type'];
    return typeof v === 'string' ? v : undefined;
}
function eventType(frame) {
    const v = frame.headers[':event-type'];
    return typeof v === 'string' ? v : undefined;
}
function exceptionType(frame) {
    const v = frame.headers[':exception-type'];
    return typeof v === 'string' ? v : undefined;
}
function errorCode(frame) {
    const v = frame.headers[':error-code'];
    return typeof v === 'string' ? v : undefined;
}
/**
 * Try to parse a single frame from the buffer.
 * Returns the frame plus number of bytes consumed, or null if more data is needed.
 */
function parseFrame(buffer) {
    if (buffer.length < PRELUDE_SIZE)
        return null;
    const totalLength = buffer.readUInt32BE(0);
    const headerLength = buffer.readUInt32BE(4);
    const preludeCrc = buffer.readUInt32BE(8);
    if (totalLength < MIN_MESSAGE_SIZE) {
        throw new ParseError(`Message too small: ${totalLength} < ${MIN_MESSAGE_SIZE}`);
    }
    if (totalLength > MAX_MESSAGE_SIZE) {
        throw new ParseError(`Message too large: ${totalLength} > ${MAX_MESSAGE_SIZE}`);
    }
    if (buffer.length < totalLength)
        return null; // need more data
    const actualPreludeCrc = crc32(buffer, 0, 8);
    if (actualPreludeCrc !== preludeCrc) {
        throw new ParseError(`Prelude CRC mismatch: expected ${preludeCrc}, got ${actualPreludeCrc}`);
    }
    const messageCrc = buffer.readUInt32BE(totalLength - 4);
    const actualMessageCrc = crc32(buffer, 0, totalLength - 4);
    if (actualMessageCrc !== messageCrc) {
        throw new ParseError(`Message CRC mismatch: expected ${messageCrc}, got ${actualMessageCrc}`);
    }
    const headersStart = PRELUDE_SIZE;
    const headersEnd = headersStart + headerLength;
    if (headersEnd > totalLength - 4) {
        throw new ParseError('Header length exceeds message boundary');
    }
    const headers = parseHeaders(buffer.subarray(headersStart, headersEnd), headerLength);
    const payload = buffer.subarray(headersEnd, totalLength - 4);
    return { frame: { headers, payload: Buffer.from(payload) }, consumed: totalLength };
}
// ---------------------------------------------------------------------------
// Streaming decoder (stateful, tolerant)
// ---------------------------------------------------------------------------
class EventStreamDecoder {
    maxErrors;
    buffer = Buffer.alloc(0);
    errorCount = 0;
    stopped = false;
    constructor(maxErrors = DEFAULT_MAX_ERRORS) {
        this.maxErrors = maxErrors;
    }
    /** Append incoming bytes to the internal buffer. */
    feed(chunk) {
        this.buffer = this.buffer.length === 0 ? Buffer.from(chunk) : Buffer.concat([this.buffer, chunk]);
    }
    /**
     * Decode all complete frames currently available in the buffer.
     * Tolerant: on a parse error it skips bytes/frames and continues, up to maxErrors.
     */
    decodeAll() {
        const frames = [];
        if (this.stopped)
            return frames;
        // eslint-disable-next-line no-constant-condition
        while (true) {
            if (this.buffer.length === 0)
                break;
            let result;
            try {
                result = parseFrame(this.buffer);
            }
            catch (err) {
                this.errorCount++;
                if (this.errorCount >= this.maxErrors) {
                    this.stopped = true;
                    break;
                }
                this.recover(err);
                continue;
            }
            if (result === null)
                break; // need more data
            frames.push(result.frame);
            this.buffer = this.buffer.subarray(result.consumed);
            this.errorCount = 0;
        }
        return frames;
    }
    /** Attempt fault recovery by skipping a corrupted frame or a single byte. */
    recover(error) {
        if (this.buffer.length === 0)
            return;
        const msg = error.message;
        // Data-stage errors: frame boundary likely correct, skip the whole frame.
        if (msg.includes('Message CRC') || msg.includes('Header')) {
            if (this.buffer.length >= PRELUDE_SIZE) {
                const totalLength = this.buffer.readUInt32BE(0);
                if (totalLength >= MIN_MESSAGE_SIZE && totalLength <= this.buffer.length) {
                    this.buffer = this.buffer.subarray(totalLength);
                    return;
                }
            }
        }
        // Otherwise skip one byte and re-scan for a valid boundary.
        this.buffer = this.buffer.subarray(1);
    }
    isStopped() {
        return this.stopped;
    }
}
exports.EventStreamDecoder = EventStreamDecoder;
//# sourceMappingURL=event-stream-parser.js.map