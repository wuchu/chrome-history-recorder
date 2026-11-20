"use strict";
/**
 * AI Package
 *
 * Ollama-backed vision classification, renaming, and translation for the
 * media app. Media access is injected via `MediaReader` so this package has
 * no transport or storage dependency at runtime.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.bytesToBase64Chunked = exports.encodeBase64Async = exports.resolveTemplate = exports.renderTemplate = exports.DEFAULT_PROMPT_TEMPLATES = exports.selectPreferredOllamaModel = exports.DEFAULT_PREFERRED_MODEL = exports.OllamaClient = void 0;
var ollama_client_1 = require("./ollama-client");
Object.defineProperty(exports, "OllamaClient", { enumerable: true, get: function () { return ollama_client_1.OllamaClient; } });
Object.defineProperty(exports, "DEFAULT_PREFERRED_MODEL", { enumerable: true, get: function () { return ollama_client_1.DEFAULT_PREFERRED_MODEL; } });
Object.defineProperty(exports, "selectPreferredOllamaModel", { enumerable: true, get: function () { return ollama_client_1.selectPreferredOllamaModel; } });
var prompt_templates_1 = require("./prompt-templates");
Object.defineProperty(exports, "DEFAULT_PROMPT_TEMPLATES", { enumerable: true, get: function () { return prompt_templates_1.DEFAULT_PROMPT_TEMPLATES; } });
Object.defineProperty(exports, "renderTemplate", { enumerable: true, get: function () { return prompt_templates_1.renderTemplate; } });
Object.defineProperty(exports, "resolveTemplate", { enumerable: true, get: function () { return prompt_templates_1.resolveTemplate; } });
var base64_1 = require("./base64");
Object.defineProperty(exports, "encodeBase64Async", { enumerable: true, get: function () { return base64_1.encodeBase64Async; } });
Object.defineProperty(exports, "bytesToBase64Chunked", { enumerable: true, get: function () { return base64_1.bytesToBase64Chunked; } });
//# sourceMappingURL=index.js.map