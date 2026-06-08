/**
 * AI Classify - Ollama Classifier
 */

import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { Config, ClassificationResult, FilenameStyle } from './types.js';
import { preprocessImage, cleanupTempFile as cleanupImageTemp } from './imagePreprocessor.js';
import {
  extractFrame,
  cleanupTempFile as cleanupVideoTemp,
  checkFfmpegAvailable,
} from './videoFrameExtractor.js';

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
const VIDEO_EXTENSIONS = ['.mp4'];

type PresetType = Pick<Config, 'language' | 'filenameStyle' | 'filenameStylePrompt'>;

/**
 * Style prompts for filename naming
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
 * Build prompt for image/video classification
 * Supports language and filename style configuration
 */
const buildPrompt = (preset: PresetType) => {
  const isZh = preset.language?.startsWith('zh-');

  // Determine style prompt (custom > preset > default)
  const style = preset.filenameStyle || 'auto';
  const stylePrompt =
    preset.filenameStylePrompt || (isZh ? STYLE_PROMPTS_ZH[style] : STYLE_PROMPTS_EN[style]);

  if (isZh) {
    return `识别这张图片。
输出格式: 分类 | 文件名
分类用一个词，文件名用中文（不含扩展名）。
文件名控制在15-25个字以内，简洁生动。
风格要求: ${stylePrompt}
示例: 猫咪 | 慵懒的黑白猫咪在窗台晒太阳`.trim();
  }

  return `Identify this image.
Output format: CATEGORY | FILENAME
One word category. Filename in English (no extension).
Filename should be 3-8 words, concise and descriptive.
Style: ${stylePrompt}
Example: cat | lazy_cat_sunbathing_on_window`.trim();
};

/**
 * Sanitize filename - allow Chinese, remove only filesystem-forbidden characters
 */
function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[/\\:*?"<>|]/g, '') // Remove filesystem forbidden characters
      .replace(/\s+/g, '_') // Spaces to underscores
      .trim()
      .slice(0, 50) || 'unnamed'
  ); // Length limit, fallback to 'unnamed'
}

/**
 * Sanitize category - lowercase, trim
 */
function sanitizeCategory(cat: string): string {
  return cat.trim().toLowerCase() || 'unknown';
}

/**
 * Get basename from file path (without extension)
 */
function getBasename(filePath: string): string {
  const base = path.basename(filePath);
  const ext = path.extname(base);
  return path.basename(base, ext);
}

/**
 * Parse classification result with multiple fallbacks
 * Priority: pipe-separated > space-separated > JSON > original filename
 */
function parseClassificationResult(content: string, originalPath: string): ClassificationResult {
  const cleanContent = content.trim();

  // 1. Try pipe-separated format: "cat | kitty" or "猫咪 | 可爱的小猫"
  if (cleanContent.includes('|')) {
    const parts = cleanContent.split('|').map((s) => s.trim());
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return {
        category: sanitizeCategory(parts[0]),
        suggestedName: sanitizeFilename(parts[1]),
        tags: [],
        confidence: 0.8,
      };
    }
  }

  // 2. Try space-separated (first line): "cat kitty"
  const firstLine = cleanContent.split('\n')[0].trim();
  const words = firstLine.split(/\s+/).filter((w) => w.length > 0);
  if (words.length >= 2) {
    return {
      category: sanitizeCategory(words[0]),
      suggestedName: sanitizeFilename(words.slice(1).join('_')),
      tags: [],
      confidence: 0.6,
    };
  }

  // 3. Try JSON format (backward compatibility)
  const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        category: sanitizeCategory(parsed.category || 'unknown'),
        suggestedName: sanitizeFilename(parsed.suggestedName || getBasename(originalPath)),
        tags: parsed.tags || [],
        confidence: parsed.confidence || 0.5,
      };
    } catch {
      // JSON parse failed, continue to fallback
    }
  }

  // 4. Fallback - use original filename
  return {
    category: 'unknown',
    suggestedName: getBasename(originalPath),
    tags: [],
    confidence: 0.1,
  };
}

export async function checkOllamaHealth(config: Config): Promise<boolean> {
  try {
    const response = await axios.get(`${config.ollamaEndpoint}/api/tags`, {
      timeout: 5000,
      headers: {
        Authorization: 'Bearer ollama',
      },
    });
    return response.status === 200;
  } catch {
    return false;
  }
}

function isImage(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext);
}

function isVideoFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return VIDEO_EXTENSIONS.includes(ext);
}

async function classifyImage(filePath: string, config: Config): Promise<ClassificationResult> {
  const { path: processedPath, wasConverted } = await preprocessImage(filePath);

  try {
    const imageBuffer = await fs.readFile(processedPath);
    const base64Image = imageBuffer.toString('base64');

    const prompt = buildPrompt(config);

    const response = await axios.post(
      `${config.ollamaEndpoint}/api/chat`,
      {
        model: config.visionModel,
        messages: [
          {
            role: 'user',
            content: prompt,
            images: [base64Image],
          },
        ],
        stream: false,
      },
      {
        timeout: 60000,
        headers: {
          Authorization: 'Bearer ollama',
        },
      }
    );

    const content = response.data.message?.content || '';
    return parseClassificationResult(content, filePath);
  } finally {
    if (wasConverted) {
      await cleanupImageTemp(processedPath);
    }
  }
}

async function classifyVideo(filePath: string, config: Config): Promise<ClassificationResult> {
  const ffmpegAvailable = await checkFfmpegAvailable();
  if (!ffmpegAvailable) {
    console.warn('Warning: ffmpeg not available, cannot process video files');
    return {
      category: 'video',
      suggestedName: getBasename(filePath),
      tags: ['video', 'unprocessed'],
      confidence: 0.2,
    };
  }

  const framePath = await extractFrame(filePath);

  try {
    const imageBuffer = await fs.readFile(framePath);
    const base64Image = imageBuffer.toString('base64');

    const prompt = buildPrompt(config);

    const response = await axios.post(
      `${config.ollamaEndpoint}/api/chat`,
      {
        model: config.visionModel,
        messages: [
          {
            role: 'user',
            content: prompt,
            images: [base64Image],
          },
        ],
        stream: false,
      },
      {
        timeout: 60000,
        headers: {
          Authorization: 'Bearer ollama',
        },
      }
    );

    const content = response.data.message?.content || '';
    const result = parseClassificationResult(content, filePath);
    result.tags.push('video');
    return result;
  } finally {
    await cleanupVideoTemp(framePath);
  }
}

export async function classifyFile(
  filePath: string,
  config: Config
): Promise<ClassificationResult> {
  if (isImage(filePath)) {
    return classifyImage(filePath, config);
  }

  if (isVideoFile(filePath)) {
    return classifyVideo(filePath, config);
  }

  return {
    category: 'other',
    suggestedName: getBasename(filePath),
    tags: ['non-media'],
    confidence: 0.1,
  };
}
