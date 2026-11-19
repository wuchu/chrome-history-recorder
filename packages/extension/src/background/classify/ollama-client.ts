/**
 * Extension Background - Ollama Client
 *
 * HTTP client for Ollama API.
 */

import { getVFSWebSocketClient } from '../vfs-ws-client';
import type { FilenameStyle } from '../../shared/extension-runtime';

/**
 * Classification result (legacy shape kept for compatibility).
 */
export interface ClassificationResult {
  category: string;
  suggestedName: string;
  tags: string[];
  confidence: number;
}

/**
 * Tag-focused classification result produced by a single vision call.
 */
export interface TagClassificationResult {
  tags: string[];
  aliases: Record<string, string>;
  confidence: number;
  model: string;
}

/**
 * Rename result produced by a single vision call.
 */
export interface RenameResult {
  suggestedName: string;
  model: string;
}

/**
 * Ollama model returned by /api/tags
 */
export interface OllamaModel {
  name: string;
  modifiedAt?: string;
  size?: number;
  family?: string;
  parameterSize?: string;
  quantizationLevel?: string;
}

interface OllamaTagsResponse {
  models?: Array<{
    name?: string;
    modified_at?: string;
    size?: number;
    details?: {
      family?: string;
      parameter_size?: string;
      quantization_level?: string;
    };
  }>;
}

/**
 * Ollama Client configuration
 */
export interface OllamaClientConfig {
  endpoint?: string;
  model?: string | undefined;
  language?: string;
  filenameStyle?: FilenameStyle;
  filenameStylePrompt?: string;
  timeout?: number;
}

/**
 * Style prompts (Chinese)
 */
const STYLE_PROMPTS_ZH: Record<FilenameStyle, string> = {
  auto: '根据图片内容和氛围，自动选择最合适的描述风格。',
  fun: '用活泼有趣的语气描述，像在讲故事，充满俏皮感。',
  sexy: '用优雅迷人的语气描述，富有吸引力和美感。',
  artistic: '用艺术感的语气描述，像在描述一幅画作或摄影作品。',
  poetic: '用诗意的语气描述，充满意境和情感。',
  minimal: '用最简洁的语气描述，只保留核心信息，不要修饰词。',
  professional: '用专业简洁的语气描述，客观准确，不带感情色彩。',
  narrative: '用故事叙述的语气描述，描述场景中的情节。',
};

/**
 * Style prompts (English)
 */
const STYLE_PROMPTS_EN: Record<FilenameStyle, string> = {
  auto: 'Automatically choose the most appropriate style based on image content.',
  fun: 'Use playful and fun tone, like telling a story.',
  sexy: 'Use elegant and charming tone, with appeal and beauty.',
  artistic: 'Use artistic tone, like describing a painting or photograph.',
  poetic: 'Use poetic tone, with mood and emotion.',
  minimal: 'Use minimal tone, only core information, no adjectives.',
  professional: 'Use professional and concise tone, objective and factual.',
  narrative: 'Use narrative tone, describe the scene and story.',
};

/**
 * Build the tag classification prompt. The vocabulary is a bounded top-N
 * window; the model may reuse an existing canonical tag or declare a new one.
 */
function buildTagsPrompt(vocabulary: string[], language?: string): string {
  const isZh = language?.startsWith('zh-');
  const vocab = vocabulary.map((tag) => tag.trim()).filter(Boolean);

  if (isZh) {
    const vocabBlock =
      vocab.length > 0
        ? `已有标签（含义相同或相近时，直接复用已有标签名，不要创造近义词）：\n${vocab.join('、')}`
        : '当前词表为空，可以自由创建标签。';
    return `识别这张图片，生成 3 到 8 个描述图片内容的标签。
${vocabBlock}

输出要求：
- 每行一个标签，不要编号、不要解释、不要标点。
- 复用已有标签时直接输出标签名。
- 词表中没有的新概念，输出 NEW:标签名。
- 标签使用小写，2-6 个字。`.trim();
  }

  const vocabBlock =
    vocab.length > 0
      ? `Existing tags (reuse the exact name when the meaning matches or is close; do not invent near-synonyms):\n${vocab.join(', ')}`
      : 'The vocabulary is empty; feel free to create tags.';
  return `Identify this image and produce 3 to 8 tags describing its content.
${vocabBlock}

Output rules:
- One tag per line. No numbering, explanations, or punctuation.
- Reuse an existing tag name directly when it fits.
- For concepts not in the vocabulary, output NEW:<tag>.
- Use lowercase tags of 1-3 words.`.trim();
}

/**
 * Build the independent rename prompt. Rename does not receive or produce tags.
 */
function buildRenamePrompt(config: OllamaClientConfig): string {
  const isZh = config.language?.startsWith('zh-');
  const style = config.filenameStyle ?? 'auto';
  const stylePrompt =
    config.filenameStylePrompt ?? (isZh ? STYLE_PROMPTS_ZH[style] : STYLE_PROMPTS_EN[style]);

  if (isZh) {
    return `观察这张图片，为它生成一个简洁生动的文件名（不含扩展名）。
风格要求：${stylePrompt}
文件名控制在 15-25 个字以内。
只输出文件名本身，不要引号、扩展名或任何解释。`.trim();
  }

  return `Look at this image and generate a concise, descriptive filename (without extension).
Style: ${stylePrompt}
Filename should be 3-8 words.
Output only the filename itself, without quotes, extension, or explanation.`.trim();
}

/**
 * Sanitize filename
 */
function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[/\\:*?"<>|]/g, '')
      .replace(/\s+/g, '_')
      .trim()
      .slice(0, 50) || 'unnamed'
  );
}

/**
 * Normalize Ollama model list response
 */
function normalizeOllamaModels(data: OllamaTagsResponse): OllamaModel[] {
  const models = data.models ?? [];
  const unique = new Map<string, OllamaModel>();

  for (const model of models) {
    const name = model.name?.trim();
    if (!name || unique.has(name)) continue;

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
function isLikelyVisionModel(model: OllamaModel): boolean {
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
 * If this exact tag is installed locally, it wins over family-based matching.
 */
export const DEFAULT_PREFERRED_MODEL = 'gemma4:e4b';

export function selectPreferredOllamaModel(
  models: OllamaModel[],
  currentModel?: string
): string | null {
  if (models.length === 0) return null;

  // 1. Honor an already-configured model when it's still installed and looks like a vision model.
  const current = currentModel ? models.find((model) => model.name === currentModel) : undefined;
  if (current && isLikelyVisionModel(current)) {
    return current.name;
  }

  // 2. Prefer the hard-coded default tag (e.g. gemma4:e4b) when it is installed.
  const preferred = models.find((model) => model.name === DEFAULT_PREFERRED_MODEL);
  if (preferred) {
    return preferred.name;
  }

  // 3. Fall back to the first vision-family model the server reports.
  const visionModels = models.filter(isLikelyVisionModel);
  if (visionModels.length > 0) {
    return visionModels[0].name;
  }

  // 4. Last resort: the first model returned by the server.
  return models[0].name;
}

/**
 * Normalize binary data returned through JSON/WebSocket.
 */
function normalizeFileBuffer(buffer: number[] | { type?: string; data?: number[] }): ArrayBuffer {
  const bytes = Array.isArray(buffer) ? buffer : Array.isArray(buffer.data) ? buffer.data : [];

  if (bytes.length === 0) {
    throw new Error('VFS returned empty or invalid file buffer');
  }

  return new Uint8Array(bytes).buffer;
}

/**
 * Parse an AI tag response. Accepts newline-, comma-, or JSON-formatted tags,
 * with or without the `NEW:` marker. Returns de-duplicated candidates; the VFS
 * resolves them against the vocabulary and alias cache.
 */
function parseTagsResult(content: string): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string) => {
    let value = raw.trim();
    value = value.replace(/^[-*•\d.)\s]+/, '').trim();
    value = value.replace(/^tags?\s*[:：]\s*/i, '').trim();
    value = value.replace(/^new\s*[:：]\s*/i, '').trim();
    value = value.replace(/^["'`]+|["'`]+$/g, '').trim();
    value = value.replace(/[。.;；,，]+$/g, '').trim();
    if (!value || value.length > 40) return;
    if (/^(输出|格式|要求|示例|标签|note|output|format|rules?)/i.test(value)) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    tags.push(value);
  };

  const jsonArray = content.match(/\[[\s\S]*\]/);
  if (jsonArray) {
    try {
      const parsed = JSON.parse(jsonArray[0]);
      if (Array.isArray(parsed)) {
        parsed.filter((tag): tag is string => typeof tag === 'string').forEach(push);
        if (tags.length > 0) return tags.slice(0, 12);
      }
    } catch {
      // fall through to line parsing
    }
  }

  const jsonObject = content.match(/\{[\s\S]*\}/);
  if (jsonObject) {
    try {
      const parsed = JSON.parse(jsonObject[0]);
      if (Array.isArray(parsed.tags)) {
        parsed.tags.filter((tag: unknown): tag is string => typeof tag === 'string').forEach(push);
        if (tags.length > 0) return tags.slice(0, 12);
      }
    } catch {
      // fall through to line parsing
    }
  }

  for (const line of content.split('\n')) {
    const cleaned = line.trim();
    if (!cleaned) continue;
    const parts = cleaned.split(/[,，、|]/);
    if (parts.length > 1) {
      parts.forEach(push);
    } else {
      push(cleaned);
    }
  }

  return tags.slice(0, 12);
}

/**
 * Parse an AI rename response into a sanitized display filename.
 */
function parseRenameResult(content: string, hash: string): string {
  const firstLine = content
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) return hash;

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
export class OllamaClient {
  private config: OllamaClientConfig;
  private available: boolean = false;
  private onStatusCallback?: (available: boolean) => void;
  private healthCheckInterval?: ReturnType<typeof setInterval>;
  private lastHealthStatus?: boolean;

  constructor(config: OllamaClientConfig = {}) {
    this.config = {
      endpoint: config.endpoint ?? 'http://localhost:11434',
      // model 不设置默认值，从服务端接口选择返回的第一个
      model: config.model,
      language: config.language ?? 'zh-CN',
      filenameStyle: config.filenameStyle ?? 'auto',
      filenameStylePrompt: config.filenameStylePrompt,
      timeout: config.timeout ?? 60000,
    };
  }

  /**
   * Check Ollama health
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.endpoint}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      const newStatus = response.ok;

      // Trigger callback if status changed OR if this is the first check
      if (this.lastHealthStatus === undefined || this.lastHealthStatus !== newStatus) {
        console.log(
          `[OllamaClient] Health status changed: ${this.lastHealthStatus ?? 'unknown'} -> ${newStatus}`
        );
        this.lastHealthStatus = newStatus;
        this.available = newStatus;
        this.onStatusCallback?.(newStatus);
      }

      return this.available;
    } catch {
      const newStatus = false;

      // Trigger callback if status changed OR if this is the first check
      if (this.lastHealthStatus === undefined || this.lastHealthStatus !== newStatus) {
        console.log(
          `[OllamaClient] Health status changed: ${this.lastHealthStatus ?? 'unknown'} -> ${newStatus}`
        );
        this.lastHealthStatus = newStatus;
        this.available = false;
        this.onStatusCallback?.(newStatus);
      }

      return false;
    }
  }

  /**
   * Start periodic health check
   */
  startPeriodicHealthCheck(intervalMs: number = 30000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    console.log(`[OllamaClient] Starting periodic health check (interval: ${intervalMs}ms)`);
    this.healthCheckInterval = setInterval(() => {
      this.checkHealth().catch((error) => {
        console.error('[OllamaClient] Periodic health check failed:', error);
      });
    }, intervalMs);
  }

  /**
   * Stop periodic health check
   */
  stopPeriodicHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      console.log('[OllamaClient] Stopped periodic health check');
    }
  }

  /**
   * Check if available
   */
  isAvailable(): boolean {
    return this.available;
  }

  /**
   * List installed Ollama models
   */
  async listModels(): Promise<OllamaModel[]> {
    try {
      const response = await fetch(`${this.config.endpoint}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`Ollama model list error: ${response.status}`);
      }

      const data = (await response.json()) as OllamaTagsResponse;
      return normalizeOllamaModels(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to list Ollama models: ${message}`);
    }
  }

  /**
   * Select and apply the best installed model if the current one is unavailable
   */
  async selectAvailableModel(): Promise<{
    models: OllamaModel[];
    selectedModel: string | null;
    changed: boolean;
  }> {
    const models = await this.listModels();
    const selectedModel = selectPreferredOllamaModel(models, this.config.model);
    const changed = Boolean(selectedModel && selectedModel !== this.config.model);

    if (selectedModel && changed) {
      this.updateConfig({ model: selectedModel });
    }

    if (!selectedModel && models.length > 0) {
      console.warn(
        '[OllamaClient] Installed Ollama models do not look like vision models:',
        models.map((model) => model.name).join(', ')
      );
    }

    return { models, selectedModel, changed };
  }

  /**
   * Set status callback
   */
  onStatus(callback: (available: boolean) => void): void {
    this.onStatusCallback = callback;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<OllamaClientConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): OllamaClientConfig {
    return this.config;
  }

  /**
   * Obtain a representative image for a media hash (large thumbnail when
   * available, otherwise the original blob).
   */
  async getRepresentativeImage(hash: string): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
    const vfsWsClient = getVFSWebSocketClient();
    const file = await vfsWsClient.getFile(hash);
    if (!file) {
      throw new Error(`File not found: ${hash}`);
    }

    try {
      const thumbnail = await vfsWsClient.getThumbnail(hash, 'large');
      if (thumbnail) {
        return {
          buffer: normalizeFileBuffer(thumbnail.buffer),
          mimeType: thumbnail.mimeType,
        };
      }
    } catch (error) {
      console.warn('[OllamaClient] Failed to get thumbnail, using original file:', error);
    }

    return {
      buffer: normalizeFileBuffer(file.buffer),
      mimeType: file.mimeType,
    };
  }

  /**
   * Send a single vision request to Ollama and return the text content.
   */
  private async callVision(prompt: string, buffer: ArrayBuffer): Promise<string> {
    if (!this.available) {
      throw new Error('Ollama service not available');
    }

    const base64Image = btoa(
      new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

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
        throw new Error(
          `Ollama model not found or chat endpoint unavailable for model "${this.config.model}"${detail}. ` +
            `Select an installed vision model from the model dropdown or run: ollama pull ${this.config.model}`
        );
      }
      if (response.status === 400) {
        throw new Error(
          `Ollama rejected the image request for model "${this.config.model}"${detail}. ` +
            'This usually means the selected model does not support images. Select a vision model such as llava:7b.'
        );
      }
      throw new Error(`Ollama API error: ${response.status}${detail}`);
    }

    const data = await response.json();
    return data.message?.content ?? '';
  }

  /**
   * Classification task: one vision call that generates tags and
   * canonicalizes them against the top-N vocabulary.
   */
  async classifyTagsByHash(hash: string): Promise<TagClassificationResult> {
    const vfsWsClient = getVFSWebSocketClient();
    let vocabulary: string[] = [];
    try {
      vocabulary = await vfsWsClient.getTagVocabulary(40);
    } catch (error) {
      console.warn('[OllamaClient] Failed to load tag vocabulary, using empty window:', error);
    }

    const { buffer } = await this.getRepresentativeImage(hash);
    const content = await this.callVision(
      buildTagsPrompt(vocabulary, this.config.language),
      buffer
    );
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
  async renameByHash(hash: string): Promise<RenameResult> {
    const { buffer } = await this.getRepresentativeImage(hash);
    const content = await this.callVision(buildRenamePrompt(this.config), buffer);
    return {
      suggestedName: parseRenameResult(content, hash),
      model: this.config.model ?? '',
    };
  }

  /**
   * Legacy combined classification entry point (kept for compatibility).
   * Classification no longer writes `category`.
   */
  async classifyByHash(hash: string): Promise<ClassificationResult> {
    const result = await this.classifyTagsByHash(hash);
    const applied = await getVFSWebSocketClient().applyClassification({
      hash,
      tags: result.tags,
      aliases: result.aliases,
      confidence: result.confidence,
      modelUsed: result.model,
    });
    return {
      category: '',
      suggestedName: '',
      tags: applied.tags,
      confidence: result.confidence,
    };
  }

  /**
   * Translate tag names to Chinese
   */
  async translateTags(text: string): Promise<string> {
    if (!this.available) {
      throw new Error('Ollama service not available');
    }

    const isZh = this.config.language?.startsWith('zh-');
    const prompt = isZh
      ? `请将以下标签翻译成中文，并保留原来的格式（每行一个标签，如果有逗号分隔，左边是英文名称，右边是中文显示名称）。

如果一行只有一个词，请同时生成英文名称和中文显示名称，用逗号分隔。

输入：
${text}

直接输出结果，不要任何其他说明。`
      : `Translate the following tags to Chinese, keep the original format (one tag per line. If comma-separated, left is English name, right is Chinese display name).

If a line only has one word, generate both English name and Chinese display name separated by comma.

Input:
${text}

Output directly without any extra explanation.`;

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

      const data = await response.json();
      const content = data.message?.content ?? '';
      return content.trim();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[OllamaClient] Translation failed:', message);
      throw new Error(`Translation failed: ${message}`);
    }
  }
}

// Singleton instance
let ollamaClient: OllamaClient | null = null;

/**
 * Get Ollama Client singleton
 */
export function getOllamaClient(): OllamaClient {
  if (!ollamaClient) {
    ollamaClient = new OllamaClient();
  }
  return ollamaClient;
}

/**
 * Initialize Ollama Client
 */
export async function initOllamaClient(config?: OllamaClientConfig): Promise<OllamaClient> {
  ollamaClient = new OllamaClient(config);
  // Don't check health here - let caller set onStatus callback first
  // await ollamaClient.checkHealth();
  return ollamaClient;
}
