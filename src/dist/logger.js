"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
/**
 * Default console-based logger with JSON structured output.
 */
exports.logger = {
    trace(msg, data) {
        if (process.env.LOG_LEVEL === 'trace') {
            console.log(JSON.stringify({ level: 'trace', msg, ...data, timestamp: new Date().toISOString() }));
        }
    },
    debug(msg, data) {
        console.debug(JSON.stringify({ level: 'debug', msg, ...data, timestamp: new Date().toISOString() }));
    },
    info(msg, data) {
        console.info(JSON.stringify({ level: 'info', msg, ...data, timestamp: new Date().toISOString() }));
    },
    warn(msg, data) {
        console.warn(JSON.stringify({ level: 'warn', msg, ...data, timestamp: new Date().toISOString() }));
    },
    error(msg, data) {
        console.error(JSON.stringify({ level: 'error', msg, ...data, timestamp: new Date().toISOString() }));
    },
};
//# sourceMappingURL=logger.js.map