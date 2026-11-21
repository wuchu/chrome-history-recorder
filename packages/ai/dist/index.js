"use strict";
/**
 * AI Package
 *
 * Ollama-backed vision classification, renaming, and translation for the
 * media app. Media access is injected via `MediaReader` so this package has
 * no transport or storage dependency at runtime.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.bytesToBase64Chunked = exports.encodeBase64Async = exports.resolveTemplate = exports.renderTemplate = exports.DEFAULT_PROMPT_TEMPLATES = exports.isUnprocessableMediaError = exports.UnprocessableMediaError = exports.normalizeMimeType = exports.isNativeVisionMimeType = exports.evaluateMediaEligibility = exports.NATIVE_VISION_MIME_TYPES = exports.selectPreferredOllamaModel = exports.DEFAULT_PREFERRED_MODEL = exports.OllamaClient = void 0;
var ollama_client_1 = require("./ollama-client");
Object.defineProperty(exports, "OllamaClient", { enumerable: true, get: function () { return ollama_client_1.OllamaClient; } });
Object.defineProperty(exports, "DEFAULT_PREFERRED_MODEL", { enumerable: true, get: function () { return ollama_client_1.DEFAULT_PREFERRED_MODEL; } });
Object.defineProperty(exports, "selectPreferredOllamaModel", { enumerable: true, get: function () { return ollama_client_1.selectPreferredOllamaModel; } });
var eligibility_1 = require("./eligibility");
Object.defineProperty(exports, "NATIVE_VISION_MIME_TYPES", { enumerable: true, get: function () { return eligibility_1.NATIVE_VISION_MIME_TYPES; } });
Object.defineProperty(exports, "evaluateMediaEligibility", { enumerable: true, get: function () { return eligibility_1.evaluateMediaEligibility; } });
Object.defineProperty(exports, "isNativeVisionMimeType", { enumerable: true, get: function () { return eligibility_1.isNativeVisionMimeType; } });
Object.defineProperty(exports, "normalizeMimeType", { enumerable: true, get: function () { return eligibility_1.normalizeMimeType; } });
var errors_1 = require("./errors");
Object.defineProperty(exports, "UnprocessableMediaError", { enumerable: true, get: function () { return errors_1.UnprocessableMediaError; } });
Object.defineProperty(exports, "isUnprocessableMediaError", { enumerable: true, get: function () { return errors_1.isUnprocessableMediaError; } });
var prompt_templates_1 = require("./prompt-templates");
Object.defineProperty(exports, "DEFAULT_PROMPT_TEMPLATES", { enumerable: true, get: function () { return prompt_templates_1.DEFAULT_PROMPT_TEMPLATES; } });
Object.defineProperty(exports, "renderTemplate", { enumerable: true, get: function () { return prompt_templates_1.renderTemplate; } });
Object.defineProperty(exports, "resolveTemplate", { enumerable: true, get: function () { return prompt_templates_1.resolveTemplate; } });
var base64_1 = require("./base64");
Object.defineProperty(exports, "encodeBase64Async", { enumerable: true, get: function () { return base64_1.encodeBase64Async; } });
Object.defineProperty(exports, "bytesToBase64Chunked", { enumerable: true, get: function () { return base64_1.bytesToBase64Chunked; } });
//# sourceMappingURL=index.js.map