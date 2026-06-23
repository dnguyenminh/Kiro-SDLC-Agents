"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.childDepthArgs = exports.isDepthExceeded = exports.parseRecursionArgs = exports.executeManageAutoApprove = exports.MANAGE_AUTO_APPROVE_DEFINITION = exports.executeAgentLog = exports.AGENT_LOG_DEFINITION = exports.META_TOOL_DEFINITIONS = exports.MetaToolDispatcher = void 0;
var dispatcher_js_1 = require("./dispatcher.js");
Object.defineProperty(exports, "MetaToolDispatcher", { enumerable: true, get: function () { return dispatcher_js_1.MetaToolDispatcher; } });
Object.defineProperty(exports, "META_TOOL_DEFINITIONS", { enumerable: true, get: function () { return dispatcher_js_1.META_TOOL_DEFINITIONS; } });
var agent_log_js_1 = require("./agent-log.js");
Object.defineProperty(exports, "AGENT_LOG_DEFINITION", { enumerable: true, get: function () { return agent_log_js_1.AGENT_LOG_DEFINITION; } });
Object.defineProperty(exports, "executeAgentLog", { enumerable: true, get: function () { return agent_log_js_1.executeAgentLog; } });
var manage_auto_approve_js_1 = require("./manage-auto-approve.js");
Object.defineProperty(exports, "MANAGE_AUTO_APPROVE_DEFINITION", { enumerable: true, get: function () { return manage_auto_approve_js_1.MANAGE_AUTO_APPROVE_DEFINITION; } });
Object.defineProperty(exports, "executeManageAutoApprove", { enumerable: true, get: function () { return manage_auto_approve_js_1.executeManageAutoApprove; } });
var recursion_guard_js_1 = require("./recursion-guard.js");
Object.defineProperty(exports, "parseRecursionArgs", { enumerable: true, get: function () { return recursion_guard_js_1.parseRecursionArgs; } });
Object.defineProperty(exports, "isDepthExceeded", { enumerable: true, get: function () { return recursion_guard_js_1.isDepthExceeded; } });
Object.defineProperty(exports, "childDepthArgs", { enumerable: true, get: function () { return recursion_guard_js_1.childDepthArgs; } });
//# sourceMappingURL=index.js.map