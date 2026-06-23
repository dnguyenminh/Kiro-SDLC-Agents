"use strict";
/**
 * Database module barrel export.
 * KSA-153: Graph storage
 * KSA-169: Incremental updater + persistence
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fnv1aHash = exports.IncrementalUpdater = exports.isGraphSchemaReady = exports.runGraphMigrations = exports.GraphRepository = void 0;
var graph_repository_js_1 = require("./graph-repository.js");
Object.defineProperty(exports, "GraphRepository", { enumerable: true, get: function () { return graph_repository_js_1.GraphRepository; } });
var migrator_js_1 = require("./migrator.js");
Object.defineProperty(exports, "runGraphMigrations", { enumerable: true, get: function () { return migrator_js_1.runGraphMigrations; } });
Object.defineProperty(exports, "isGraphSchemaReady", { enumerable: true, get: function () { return migrator_js_1.isGraphSchemaReady; } });
var incremental_updater_js_1 = require("./incremental-updater.js");
Object.defineProperty(exports, "IncrementalUpdater", { enumerable: true, get: function () { return incremental_updater_js_1.IncrementalUpdater; } });
Object.defineProperty(exports, "fnv1aHash", { enumerable: true, get: function () { return incremental_updater_js_1.fnv1aHash; } });
//# sourceMappingURL=index.js.map