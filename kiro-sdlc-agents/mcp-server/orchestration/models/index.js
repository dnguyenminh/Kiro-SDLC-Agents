"use strict";
/**
 * Models module — model lifecycle management for embedding search.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.listModels = exports.getModelInfo = exports.DEFAULT_MODEL = exports.MODELS = exports.ModelRegistry = exports.ModelManager = void 0;
var model_manager_js_1 = require("./model-manager.js");
Object.defineProperty(exports, "ModelManager", { enumerable: true, get: function () { return model_manager_js_1.ModelManager; } });
var model_registry_js_1 = require("./model-registry.js");
Object.defineProperty(exports, "ModelRegistry", { enumerable: true, get: function () { return model_registry_js_1.ModelRegistry; } });
var model_catalog_js_1 = require("./model-catalog.js");
Object.defineProperty(exports, "MODELS", { enumerable: true, get: function () { return model_catalog_js_1.MODELS; } });
Object.defineProperty(exports, "DEFAULT_MODEL", { enumerable: true, get: function () { return model_catalog_js_1.DEFAULT_MODEL; } });
Object.defineProperty(exports, "getModelInfo", { enumerable: true, get: function () { return model_catalog_js_1.getModelInfo; } });
Object.defineProperty(exports, "listModels", { enumerable: true, get: function () { return model_catalog_js_1.listModels; } });
//# sourceMappingURL=index.js.map