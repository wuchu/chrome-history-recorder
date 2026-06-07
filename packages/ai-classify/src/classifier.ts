/**
 * AI Classify - Ollama Classifier
 */

import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { Config, ClassificationResult } from './types.js';
import { preprocessImage, cleanupTempFile as cleanupImageTemp, needsConversion, isDirectlySupported } from './imagePreprocessor.js';
import { isVideo, extractFrame, cleanupTempFile as cleanupVideoTemp, checkFfmpegAvailable } from './videoFrameExtractor.js';

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
const VIDEO_EXTENSIONS = ['.mp4'];
const TEXT_EXTENSIONS = ['.txt', '.md', '.pdf'];

type PresetType = Pick<Config, 'imgCategories' | 'txtCategories' | 'customPrompt' | 'language'>;

// Default prompts (extracted as constants for maintainability)
const buildPrompt = (type: 'text' | 'image', preset: PresetType) => preset.language?.startsWith('zh-') ? `
${preset.customPrompt ?? ''}

分析这个 ${type} 并且给出：

1) 一个分类 (名称类似: ${(type === 'image' ? preset.imgCategories: preset.txtCategories)?.join(', ')}),
2) 一个文件名 (不需要带扩展名，如：.jpg/.mp4),
3) 标签 (逗号分隔),
4) 相似度 (0-1).

使用 JSON 格式输出: {"category": "...", "suggestedName": "...", "tags": [...], "confidence": ...}
` : `
${preset.customPrompt ?? ''}
Analyze this ${type} and provide

1) A category (one word like: ${(type === 'image' ? preset.imgCategories: preset.txtCategories)?.join(', ')}),
2) A descriptive filename suggestion (without extension),
3) Tags (comma separated),
4) Confidence level (0-1).

Format as JSON: {"category": "...", "suggestedName": "...", "tags": [...], "confidence": ...}
`;

export async function checkOllamaHealth(config: Config): Promise<boolean> {
  try {
    const response = await axios.get(`${config.ollamaEndpoint}/api/tags`, {
      timeout: 5000,
      headers: {
        'Authorization': 'Bearer ollama'
      }
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

function isText(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.includes(ext);
}

async function classifyImage(filePath: string, config: Config): Promise<ClassificationResult> {
  // Preprocess image if needed (webp -> png)
  const { path: processedPath, wasConverted } = await preprocessImage(filePath);

  try {
    const imageBuffer = await fs.readFile(processedPath);
    const base64Image = imageBuffer.toString('base64');

    const prompt = buildPrompt('image', config);

    const response = await axios.post(`${config.ollamaEndpoint}/api/chat`, {
      model: config.visionModel,
      messages: [
        {
          role: 'user',
          content: prompt,
          images: [base64Image]
        }
      ],
      stream: false
    }, {
      timeout: 60000,
      headers: {
        'Authorization': 'Bearer ollama'
      }
    });

    const content = response.data.message?.content || '';
    return parseClassificationResult(content);
  } finally {
    // Clean up temporary file if conversion occurred
    if (wasConverted) {
      await cleanupImageTemp(processedPath);
    }
  }
}

async function classifyVideo(filePath: string, config: Config): Promise<ClassificationResult> {
  // Check ffmpeg availability
  const ffmpegAvailable = await checkFfmpegAvailable();
  if (!ffmpegAvailable) {
    console.warn('Warning: ffmpeg not available, cannot process video files');
    return {
      category: 'video',
      suggestedName: path.basename(filePath, path.extname(filePath)),
      tags: ['video', 'unprocessed'],
      confidence: 0.2
    };
  }

  // Extract first frame from video
  const framePath = await extractFrame(filePath);

  try {
    // Use the extracted frame for classification
    const imageBuffer = await fs.readFile(framePath);
    const base64Image = imageBuffer.toString('base64');

    const prompt = buildPrompt('image', config);

    const response = await axios.post(`${config.ollamaEndpoint}/api/chat`, {
      model: config.visionModel,
      messages: [
        {
          role: 'user',
          content: prompt,
          images: [base64Image]
        }
      ],
      stream: false
    }, {
      timeout: 60000,
      headers: {
        'Authorization': 'Bearer ollama'
      }
    });

    const content = response.data.message?.content || '';
    const result = parseClassificationResult(content);

    // Add video tag to indicate it's from a video
    result.tags.push('video');
    return result;
  } finally {
    // Clean up temporary frame file
    await cleanupVideoTemp(framePath);
  }
}

async function classifyText(filePath: string, config: Config): Promise<ClassificationResult> {
  const content = await fs.readFile(filePath, 'utf-8');
  const truncated = content.slice(0, 2000); // Limit text size

  const prompt = buildPrompt('text', config)

  const response = await axios.post(`${config.ollamaEndpoint}/api/chat`, {
    model: config.textModel,
    messages: [
      {
        role: 'user',
        content: `${prompt}\n\nText content:\n${truncated}`
      }
    ],
    stream: false
  }, {
    timeout: 60000,
    headers: {
      'Authorization': 'Bearer ollama'
    }
  });

  const result = response.data.message?.content || '';
  return parseClassificationResult(result);
}

function parseClassificationResult(content: string): ClassificationResult {
  // Try to extract JSON from response
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        category: parsed.category || 'unknown',
        suggestedName: parsed.suggestedName || 'unnamed',
        tags: parsed.tags || [],
        confidence: parsed.confidence || 0.5
      };
    }
  } catch {
    // Fallback to default
  }

  return {
    category: 'unknown',
    suggestedName: 'unnamed',
    tags: [],
    confidence: 0.1
  };
}

export async function classifyFile(filePath: string, config: Config): Promise<ClassificationResult> {
  if (isImage(filePath)) {
    return classifyImage(filePath, config);
  }

  if (isVideoFile(filePath)) {
    return classifyVideo(filePath, config);
  }

  if (isText(filePath)) {
    return classifyText(filePath, config);
  }

  // Default classification for unknown file types
  return {
    category: 'other',
    suggestedName: path.basename(filePath, path.extname(filePath)),
    tags: [],
    confidence: 0.3
  };
}