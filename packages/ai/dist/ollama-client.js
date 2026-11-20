"use strict";
/**
 * Ollama Client
 *
 * HTTP client for the local Ollama API. Runs in the app process and reads
 * media through an injected `MediaReader` backed by the in-process VFSAPI.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaClient = exports.DEFAULT_PREFERRED_MODEL = void 0;
exports.selectPreferredOllamaModel = selectPreferredOllamaModel;
const prompt_templates_1 = require("./prompt-templates");
const base64_1 = require("./base64");
/**
 * Build the tag classification prompt from a user-editable template. The
 * vocabulary is a bounded top-N window; the model may reuse an existing
 * canonical tag or declare a new one.
 */
function buildTagsPrompt(vocabulary, template) {
    const vocab = vocabulary.map((tag) => tag.trim()).filter(Boolean);
    const vocabBlock = vocab.length > 0
        ? `已有标签（含义相同或相近时，直接复用已有标签名，不要创造近义词）：\n${vocab.join('、')}`
        : '当前词表为空，可以自由创建标签。';
    return (0, prompt_templates_1.renderTemplate)((0, prompt_templates_1.resolveTemplate)(template, prompt_templates_1.DEFAULT_PROMPT_TEMPLATES.classify), {
        vocabulary: vocabBlock,
    });
}
/**
 * Build the independent rename prompt from a user-editable template.
 */
function buildRenamePrompt(template) {
    return (0, prompt_templates_1.resolveTemplate)(template, prompt_templates_1.DEFAULT_PROMPT_TEMPLATES.rename);
}
/**
 * Sanitize filename
 */
function sanitizeFilename(name) {
    return (name
        .replace(/[/\\:*?"<>|]/g, '')
        .replace(/\s+/g, '_')
        .trim()
        .slice(0, 50) || 'unnamed');
}
/**
 * Normalize Ollama model list response
 */
function normalizeOllamaModels(data) {
    const models = data.models ?? [];
    const unique = new Map();
    for (const model of models) {
        const name = model.name?.trim();
        if (!name || unique.has(name))
            continue;
        unique.set(name, {
            name,
            modifiedAt: model.modified_at,
            size: model.size,
            family: model.details?.family,
            parameterSize: model.details?.parameter_size,
            quantizationLevel: model.details?.quantization_level,
        });
    }
    return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
}
/**
 * Select a usable vision model from installed Ollama models.
 */
function isLikelyVisionModel(model) {
    const name = model.name.toLowerCase();
    const family = model.family?.toLowerCase() ?? '';
    return [
        'llava',
        'bakllava',
        'moondream',
        'minicpm-v',
        'qwen2-vl',
        'qwen2.5vl',
        'qwen-vl',
        'vision',
        'vl',
        'gemma3',
        'gemma4',
    ].some((keyword) => name.includes(keyword) || family.includes(keyword));
}
/**
 * Default preferred vision model when no model is configured.
 */
exports.DEFAULT_PREFERRED_MODEL = 'gemma4:e4b';
function selectPreferredOllamaModel(models, currentModel) {
    if (models.length === 0)
        return null;
    const current = currentModel ? models.find((model) => model.name === currentModel) : undefined;
    if (current && isLikelyVisionModel(current)) {
        return current.name;
    }
    const preferred = models.find((model) => model.name === exports.DEFAULT_PREFERRED_MODEL);
    if (preferred) {
        return preferred.name;
    }
    const visionModels = models.filter(isLikelyVisionModel);
    if (visionModels.length > 0) {
        return visionModels[0].name;
    }
    return models[0].name;
}
/**
 * Convert a buffer returned by the in-process VFS into an ArrayBuffer.
 */
function normalizeFileBuffer(buffer) {
    if (Array.isArray(buffer)) {
        return new Uint8Array(buffer).buffer;
    }
    if (buffer && typeof buffer === 'object' && Array.isArray(buffer.data)) {
        return new Uint8Array(buffer.data).buffer;
    }
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    if (bytes.length === 0) {
        throw new Error('VFS returned empty or invalid file buffer');
    }
    const copy = new Uint8Array(bytes.length);
    copy.set(bytes);
    return copy.buffer;
}
/**
 * Parse an AI tag response.
 */
function parseTagsResult(content) {
    const tags = [];
    const seen = new Set();
    const push = (raw) => {
        let value = raw.trim();
        value = value.replace(/^[-*•\d.)\s]+/, '').trim();
        value = value.replace(/^tags?\s*[:：]\s*/i, '').trim();
        value = value.replace(/^new\s*[:：]\s*/i, '').trim();
        value = value.replace(/^["'`]+|["'`]+$/g, '').trim();
        value = value.replace(/[。.;；,，]+$/g, '').trim();
        if (!value || value.length > 40)
            return;
        if (/^(输出|格式|要求|示例|标签|note|output|format|rules?)/i.test(value))
            return;
        const key = value.toLowerCase();
        if (seen.has(key))
            return;
        seen.add(key);
        tags.push(value);
    };
    const jsonArray = content.match(/\[[\s\S]*\]/);
    if (jsonArray) {
        try {
            const parsed = JSON.parse(jsonArray[0]);
            if (Array.isArray(parsed)) {
                parsed.filter((tag) => typeof tag === 'string').forEach(push);
                if (tags.length > 0)
                    return tags.slice(0, 12);
            }
        }
        catch {
            // fall through to line parsing
        }
    }
    const jsonObject = content.match(/\{[\s\S]*\}/);
    if (jsonObject) {
        try {
            const parsed = JSON.parse(jsonObject[0]);
            if (Array.isArray(parsed.tags)) {
                parsed.tags.filter((tag) => typeof tag === 'string').forEach(push);
                if (tags.length > 0)
                    return tags.slice(0, 12);
            }
        }
        catch {
            // fall through to line parsing
        }
    }
    for (const line of content.split('\n')) {
        const cleaned = line.trim();
        if (!cleaned)
            continue;
        const parts = cleaned.split(/[,，、|]/);
        if (parts.length > 1) {
            parts.forEach(push);
        }
        else {
            push(cleaned);
        }
    }
    return tags.slice(0, 12);
}
/**
 * Parse an AI rename response into a sanitized display filename.
 */
function parseRenameResult(content, hash) {
    const firstLine = content
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.length > 0);
    if (!firstLine)
        return hash;
    const cleaned = firstLine
        .replace(/^文件名\s*[:：]\s*/i, '')
        .replace(/^filename\s*[:：]\s*/i, '')
        .replace(/^["'`]+|["'`]+$/g, '')
        .replace(/\.(jpe?g|png|gif|webp|avif|mp4|webm|mov)$/i, '')
        .trim();
    const sanitized = sanitizeFilename(cleaned);
    return sanitized === 'unnamed' ? hash : sanitized;
}
/**
 * Ollama Client class
 */
class OllamaClient {
    config;
    media;
    available = false;
    onStatusCallback;
    healthCheckInterval;
    lastHealthStatus;
    constructor(config) {
        this.config = {
            endpoint: config.endpoint ?? 'http://localhost:11434',
            model: config.model,
            language: config.language ?? 'zh-CN',
            promptTemplates: config.promptTemplates,
            timeout: config.timeout ?? 60000,
            media: config.media,
        };
        this.media = config.media;
    }
    /**
     * Check Ollama health
     */
    async checkHealth() {
        let newStatus = false;
        try {
            const response = await fetch(`${this.config.endpoint}/api/tags`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000),
            });
            newStatus = response.ok;
        }
        catch {
            newStatus = false;
        }
        if (this.lastHealthStatus === undefined || this.lastHealthStatus !== newStatus) {
            this.lastHealthStatus = newStatus;
            this.available = newStatus;
            this.onStatusCallback?.(newStatus);
        }
        return this.available;
    }
    /**
     * Start periodic health check
     */
    startPeriodicHealthCheck(intervalMs = 30000) {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        this.healthCheckInterval = setInterval(() => {
            this.checkHealth().catch((error) => {
                console.error('[OllamaClient] Periodic health check failed:', error);
            });
        }, intervalMs);
    }
    /**
     * Stop periodic health check
     */
    stopPeriodicHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = undefined;
        }
    }
    /**
     * Check if available
     */
    isAvailable() {
        return this.available;
    }
    /**
     * List installed Ollama models
     */
    async listModels() {
        try {
            const response = await fetch(`${this.config.endpoint}/api/tags`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000),
            });
            if (!response.ok) {
                throw new Error(`Ollama model list error: ${response.status}`);
            }
            const data = (await response.json());
            return normalizeOllamaModels(data);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to list Ollama models: ${message}`);
        }
    }
    /**
     * Select and apply the best installed model if the current one is unavailable.
     */
    async selectAvailableModel() {
        const models = await this.listModels();
        const selectedModel = selectPreferredOllamaModel(models, this.config.model);
        const changed = Boolean(selectedModel && selectedModel !== this.config.model);
        if (selectedModel && changed) {
            this.updateConfig({ model: selectedModel });
        }
        return { models, selectedModel, changed };
    }
    /**
     * Set status callback
     */
    onStatus(callback) {
        this.onStatusCallback = callback;
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = {
            ...this.config,
            ...config,
        };
    }
    /**
     * Get configuration
     */
    getConfig() {
        return this.config;
    }
    /**
     * Obtain a representative image for a media hash (large thumbnail when
     * available, otherwise the original blob), read in-process.
     */
    async getRepresentativeImage(hash) {
        try {
            const thumbnail = await this.media.getThumbnail(hash, 'large');
            if (thumbnail) {
                return {
                    buffer: normalizeFileBuffer(thumbnail.buffer),
                    mimeType: thumbnail.mimeType,
                };
            }
        }
        catch (error) {
            console.warn('[OllamaClient] Failed to get thumbnail, falling back to original file:', error);
        }
        const file = this.media.getFile(hash);
        if (!file) {
            throw new Error(`File not found: ${hash}`);
        }
        // Sending raw video bytes to a vision model fails with a misleading
        // "Failed to load image" error. Report the real problem instead.
        if (file.mimeType.startsWith('video/')) {
            throw new Error(`No representative frame available for video ${hash}; thumbnail generation failed or the video is invalid`);
        }
        // Ollama only accepts common image formats; do not send ICO/BMP/TIFF/SVG
        // originals when thumbnail generation could not produce a JPEG.
        const visionFriendly = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
        if (!visionFriendly.has(file.mimeType)) {
            throw new Error(`No representative thumbnail available for ${file.mimeType} file ${hash}; the format is not a supported vision input`);
        }
        return {
            buffer: normalizeFileBuffer(file.buffer),
            mimeType: file.mimeType,
        };
    }
    /**
     * Send a single vision request to Ollama and return the text content.
     */
    async callVision(prompt, buffer) {
        if (!this.available) {
            throw new Error('Ollama service not available');
        }
        const base64Image = await (0, base64_1.encodeBase64Async)(new Uint8Array(buffer));
        const response = await fetch(`${this.config.endpoint}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: this.config.model,
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                        images: [base64Image],
                    },
                ],
                stream: false,
            }),
            signal: AbortSignal.timeout(this.config.timeout ?? 60000),
        });
        if (!response.ok) {
            const responseText = await response.text().catch(() => '');
            const detail = responseText ? `: ${responseText}` : '';
            if (response.status === 404) {
                throw new Error(`Ollama model not found or chat endpoint unavailable for model "${this.config.model}"${detail}. ` +
                    `Select an installed vision model from the model dropdown or run: ollama pull ${this.config.model}`);
            }
            if (response.status === 400) {
                throw new Error(`Ollama rejected the image request for model "${this.config.model}"${detail}. ` +
                    'This usually means the selected model does not support images. Select a vision model such as llava:7b.');
            }
            throw new Error(`Ollama API error: ${response.status}${detail}`);
        }
        const data = (await response.json());
        return data.message?.content ?? '';
    }
    /**
     * Classification task: one vision call that generates tags and canonicalizes
     * them against the top-N vocabulary.
     */
    async classifyTagsByHash(hash) {
        let vocabulary = [];
        try {
            vocabulary = this.media.getTagVocabulary(40);
        }
        catch (error) {
            console.warn('[OllamaClient] Failed to load tag vocabulary, using empty window:', error);
        }
        const { buffer } = await this.getRepresentativeImage(hash);
        const content = await this.callVision(buildTagsPrompt(vocabulary, this.config.promptTemplates?.classify), buffer);
        const tags = parseTagsResult(content);
        return {
            tags,
            aliases: {},
            confidence: tags.length > 0 ? 0.8 : 0.1,
            model: this.config.model ?? '',
        };
    }
    /**
     * Rename task: one vision call that produces a display filename only.
     */
    async renameByHash(hash) {
        const { buffer } = await this.getRepresentativeImage(hash);
        const content = await this.callVision(buildRenamePrompt(this.config.promptTemplates?.rename), buffer);
        return {
            suggestedName: parseRenameResult(content, hash),
            model: this.config.model ?? '',
        };
    }
    /**
     * Translate tag names to Chinese
     */
    async translateTags(text) {
        if (!this.available) {
            throw new Error('Ollama service not available');
        }
        const template = (0, prompt_templates_1.resolveTemplate)(this.config.promptTemplates?.translate, prompt_templates_1.DEFAULT_PROMPT_TEMPLATES.translate);
        const prompt = (0, prompt_templates_1.renderTemplate)(template, { input: text });
        try {
            const response = await fetch(`${this.config.endpoint}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.config.model,
                    messages: [{ role: 'user', content: prompt }],
                    stream: false,
                }),
                signal: AbortSignal.timeout(this.config.timeout ?? 60000),
            });
            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status}`);
            }
            const data = (await response.json());
            return (data.message?.content ?? '').trim();
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Translation failed: ${message}`);
        }
    }
}
exports.OllamaClient = OllamaClient;
//# sourceMappingURL=ollama-client.js.map