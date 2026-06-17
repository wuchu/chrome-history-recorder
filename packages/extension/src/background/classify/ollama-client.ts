/**
 * Extension Background - Ollama Client
 *
 * HTTP client for Ollama API.
 */

import { getVFSWebSocketClient } from '../vfs-ws-client';
import type { FilenameStyle, TagDefinition } from '../../shared/extension-runtime';

/**
 * Classification result
 */
export interface ClassificationResult {
  category: string;
  suggestedName: string;
  tags: string[];
  confidence: number;
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
  userDefinedTags?: TagDefinition[];
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
 * Build classification prompt
 */
function buildPrompt(config: OllamaClientConfig): string {
  const isZh = config.language?.startsWith('zh-');
  const style = config.filenameStyle ?? 'auto';
  const stylePrompt =
    config.filenameStylePrompt ?? (isZh ? STYLE_PROMPTS_ZH[style] : STYLE_PROMPTS_EN[style]);
  const availableTags = config.userDefinedTags?.map((t) => t.name).join(', ') ?? '';

  if (isZh) {
    if (availableTags) {
      return `识别这张图片。
可用标签: ${availableTags}

输出格式: 标签1,标签2 | 文件名

从"可用标签"中选择1-3个最合适的标签，用逗号分隔。
文件名用中文（不含扩展名），15-25个字以内，简洁生动。
风格要求: ${stylePrompt}
示例: 猫咪,截图 | 慵懒的黑白猫咪在窗台晒太阳`.trim();
    }
    return `识别这张图片。
输出格式: 分类 | 文件名
分类用一个词，文件名用中文（不含扩展名）。
文件名控制在15-25个字以内，简洁生动。
风格要求: ${stylePrompt}
示例: 猫咪 | 慵懒的黑白猫咪在窗台晒太阳`.trim();
  }

  if (availableTags) {
    return `Identify this image.
Available tags: ${availableTags}

Output format: TAG1,TAG2 | FILENAME

Choose 1-3 most suitable tags from "Available tags", separated by commas.
Filename in English (no extension).
Filename should be 3-8 words, concise and descriptive.
Style: ${stylePrompt}
Example: cat,screenshot | lazy_cat_sunbathing_on_window`.trim();
  }

  return `Identify this image.
Output format: CATEGORY | FILENAME
One word category. Filename in English (no extension).
Filename should be 3-8 words, concise and descriptive.
Style: ${stylePrompt}
Example: cat | lazy_cat_sunbathing_on_window`.trim();
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
 * Sanitize category
 */
function sanitizeCategory(cat: string): string {
  return cat.trim().toLowerCase() || 'unknown';
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
 * Parse classification result
 */
function parseClassificationResult(
  content: string,
  originalHash: string,
  userDefinedTags?: TagDefinition[]
): ClassificationResult {
  const cleanContent = content.trim();

  // 1. Try pipe-separated format with tags
  if (cleanContent.includes('|')) {
    const parts = cleanContent.split('|').map((s) => s.trim());
    if (parts.length >= 2 && parts[0] && parts[1]) {
      // Parse tags from first part (comma-separated)
      let tags: string[] = [];
      let category = sanitizeCategory(parts[0]);

      if (parts[0].includes(',')) {
        const tagStrings = parts[0]
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);
        if (userDefinedTags) {
          const validTagNames = new Set(userDefinedTags.map((t) => t.name.toLowerCase()));
          tags = tagStrings.filter((t) => validTagNames.has(t)).slice(0, 3);
        } else {
          tags = tagStrings.slice(0, 3);
        }
        if (tags.length > 0) {
          category = tags[0]; // Use first tag as category for compatibility
        }
      } else if (userDefinedTags) {
        const validTagNames = new Set(userDefinedTags.map((t) => t.name.toLowerCase()));
        const tag = parts[0].toLowerCase();
        if (validTagNames.has(tag)) {
          tags = [tag];
          category = tag;
        }
      }

      return {
        category,
        suggestedName: sanitizeFilename(parts[1]),
        tags,
        confidence: 0.8,
      };
    }
  }

  // 2. Try space-separated (first line)
  const firstLine = cleanContent.split('\n')[0].trim();
  const words = firstLine.split(/\s+/).filter((w) => w.length > 0);
  if (words.length >= 2) {
    let tags: string[] = [];
    let category = sanitizeCategory(words[0]);

    if (userDefinedTags) {
      const validTagNames = new Set(userDefinedTags.map((t) => t.name.toLowerCase()));
      tags = words.filter((w) => validTagNames.has(w.toLowerCase())).slice(0, 3);
      if (tags.length > 0) {
        category = tags[0];
      }
    }

    return {
      category,
      suggestedName: sanitizeFilename(words.slice(tags.length || 1).join('_')),
      tags,
      confidence: 0.6,
    };
  }

  // 3. Try JSON format
  const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      let tags: string[] = parsed.tags ?? [];

      if (userDefinedTags && tags.length > 0) {
        const validTagNames = new Set(userDefinedTags.map((t) => t.name.toLowerCase()));
        tags = tags.filter((t: string) => validTagNames.has(t.toLowerCase())).slice(0, 3);
      }

      return {
        category: sanitizeCategory(parsed.category ?? tags[0] ?? 'unknown'),
        suggestedName: sanitizeFilename(parsed.suggestedName ?? originalHash),
        tags,
        confidence: parsed.confidence ?? 0.5,
      };
    } catch {
      // JSON parse failed, continue to fallback
    }
  }

  // 4. Fallback
  return {
    category: 'unknown',
    suggestedName: originalHash,
    tags: [],
    confidence: 0.1,
  };
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
   * Classify image buffer
   */
  async classifyImage(buffer: ArrayBuffer, _mimeType: string): Promise<ClassificationResult> {
    if (!this.available) {
      throw new Error('Ollama service not available');
    }

    // Convert buffer to base64
    const base64Image = btoa(
      new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    const prompt = buildPrompt(this.config);

    try {
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
        signal: AbortSignal.timeout(this.config.timeout!),
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
      const content = data.message?.content ?? '';
      return parseClassificationResult(content, 'unknown', this.config.userDefinedTags);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Classification failed: ${message}`);
    }
  }

  /**
   * Classify file by hash (get from VFS, classify, update metadata)
   */
  async classifyByHash(hash: string): Promise<ClassificationResult> {
    const vfsWsClient = getVFSWebSocketClient();
    const file = await vfsWsClient.getFile(hash);

    if (!file) {
      throw new Error(`File not found: ${hash}`);
    }

    let classifyBuffer: ArrayBuffer;
    let classifyMimeType = file.mimeType;

    try {
      const thumbnail = await vfsWsClient.getThumbnail(hash, 'large');
      if (thumbnail) {
        classifyBuffer = normalizeFileBuffer(thumbnail.buffer);
        classifyMimeType = thumbnail.mimeType;
        console.log(`[OllamaClient] Using large thumbnail for classification: ${hash}`);
      } else {
        classifyBuffer = normalizeFileBuffer(file.buffer);
        console.log(
          `[OllamaClient] Thumbnail unavailable, using original file for classification: ${hash}`
        );
      }
    } catch (error) {
      console.warn('[OllamaClient] Failed to get thumbnail, falling back to original file:', error);
      classifyBuffer = normalizeFileBuffer(file.buffer);
    }

    const result = await this.classifyImage(classifyBuffer, classifyMimeType);

    // Update metadata in VFS
    await vfsWsClient.updateMetadata(hash, {
      category: result.category,
      ai_filename: result.suggestedName,
      tags: JSON.stringify(result.tags),
      confidence: result.confidence,
      classified_at: new Date().toISOString(),
      model_used: this.config.model,
    });

    return result;
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
