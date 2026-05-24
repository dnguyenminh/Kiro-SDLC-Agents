"use strict";
/**
 * Cache module — adaptive token cache + KB-backed 2-level agent tool cache.
 * KSA-102: Adaptive token cache (in-memory + file persistence).
 * KSA-139: KB-backed 2-level cache (L1 global + L2 per-agent).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyError = exports.ErrorClass = exports.defaultKbCacheConfig = exports.readKbCacheConfig = exports.KbInjectionEngine = exports.KbCacheInvalidator = exports.KbCacheWriter = exports.KbCacheLookup = exports.createToolCacheEntry = exports.entryFromKbContent = exports.entryToKbContent = exports.cacheTags = exports.cacheTitle = exports.CacheSource = exports.DebouncedPersistence = exports.invalidateStale = exports.evictLru = exports.computeTokenOverlap = exports.entryFromJson = exports.entryToJson = exports.touchEntry = exports.createCacheEntry = exports.AdaptiveTokenCache = void 0;
// KSA-102: Adaptive Token Cache
var adaptive_cache_js_1 = require("./adaptive-cache.js");
Object.defineProperty(exports, "AdaptiveTokenCache", { enumerable: true, get: function () { return adaptive_cache_js_1.AdaptiveTokenCache; } });
var cache_entry_js_1 = require("./cache-entry.js");
Object.defineProperty(exports, "createCacheEntry", { enumerable: true, get: function () { return cache_entry_js_1.createCacheEntry; } });
Object.defineProperty(exports, "touchEntry", { enumerable: true, get: function () { return cache_entry_js_1.touchEntry; } });
Object.defineProperty(exports, "entryToJson", { enumerable: true, get: function () { return cache_entry_js_1.entryToJson; } });
Object.defineProperty(exports, "entryFromJson", { enumerable: true, get: function () { return cache_entry_js_1.entryFromJson; } });
var invalidation_js_1 = require("./invalidation.js");
Object.defineProperty(exports, "computeTokenOverlap", { enumerable: true, get: function () { return invalidation_js_1.computeTokenOverlap; } });
Object.defineProperty(exports, "evictLru", { enumerable: true, get: function () { return invalidation_js_1.evictLru; } });
Object.defineProperty(exports, "invalidateStale", { enumerable: true, get: function () { return invalidation_js_1.invalidateStale; } });
var persistence_js_1 = require("./persistence.js");
Object.defineProperty(exports, "DebouncedPersistence", { enumerable: true, get: function () { return persistence_js_1.DebouncedPersistence; } });
// KSA-139: KB-backed 2-Level Agent Tool Cache
var kb_models_js_1 = require("./kb-models.js");
Object.defineProperty(exports, "CacheSource", { enumerable: true, get: function () { return kb_models_js_1.CacheSource; } });
Object.defineProperty(exports, "cacheTitle", { enumerable: true, get: function () { return kb_models_js_1.cacheTitle; } });
Object.defineProperty(exports, "cacheTags", { enumerable: true, get: function () { return kb_models_js_1.cacheTags; } });
Object.defineProperty(exports, "entryToKbContent", { enumerable: true, get: function () { return kb_models_js_1.entryToKbContent; } });
Object.defineProperty(exports, "entryFromKbContent", { enumerable: true, get: function () { return kb_models_js_1.entryFromKbContent; } });
Object.defineProperty(exports, "createToolCacheEntry", { enumerable: true, get: function () { return kb_models_js_1.createToolCacheEntry; } });
var kb_lookup_js_1 = require("./kb-lookup.js");
Object.defineProperty(exports, "KbCacheLookup", { enumerable: true, get: function () { return kb_lookup_js_1.KbCacheLookup; } });
var kb_writer_js_1 = require("./kb-writer.js");
Object.defineProperty(exports, "KbCacheWriter", { enumerable: true, get: function () { return kb_writer_js_1.KbCacheWriter; } });
var kb_invalidator_js_1 = require("./kb-invalidator.js");
Object.defineProperty(exports, "KbCacheInvalidator", { enumerable: true, get: function () { return kb_invalidator_js_1.KbCacheInvalidator; } });
var kb_injector_js_1 = require("./kb-injector.js");
Object.defineProperty(exports, "KbInjectionEngine", { enumerable: true, get: function () { return kb_injector_js_1.KbInjectionEngine; } });
var kb_config_js_1 = require("./kb-config.js");
Object.defineProperty(exports, "readKbCacheConfig", { enumerable: true, get: function () { return kb_config_js_1.readKbCacheConfig; } });
Object.defineProperty(exports, "defaultKbCacheConfig", { enumerable: true, get: function () { return kb_config_js_1.defaultKbCacheConfig; } });
var error_classifier_js_1 = require("./error-classifier.js");
Object.defineProperty(exports, "ErrorClass", { enumerable: true, get: function () { return error_classifier_js_1.ErrorClass; } });
Object.defineProperty(exports, "classifyError", { enumerable: true, get: function () { return error_classifier_js_1.classifyError; } });
//# sourceMappingURL=index.js.map