/**
 * AI Classify - Image Preprocessor
 * Converts unsupported image formats (webp) to png for Ollama compatibility
 */

import sharp from 'sharp';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const NEEDS_CONVERSION = ['.webp'];
const SUPPORTED_DIRECTLY = ['.jpg', '.jpeg', '.png', '.gif', '.bmp'];

/**
 * Check if image format needs conversion before sending to Ollama
 */
export function needsConversion(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return NEEDS_CONVERSION.includes(ext);
}

/**
 * Check if image format is supported directly by Ollama
 */
export function isDirectlySupported(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_DIRECTLY.includes(ext);
}

/**
 * Convert image to PNG format
 * @param filePath Original file path
 * @returns Path to converted PNG file (temporary)
 */
export async function convertToPng(filePath: string): Promise<string> {
  const tmpDir = '/tmp/ai-classify-preprocess';
  await fs.ensureDir(tmpDir);

  const outputPath = path.join(tmpDir, `${uuidv4()}.png`);

  await sharp(filePath)
    .png()
    .toFile(outputPath);

  return outputPath;
}

/**
 * Preprocess image for Ollama compatibility
 * @param filePath Original file path
 * @returns Object with processed path and whether conversion occurred
 */
export async function preprocessImage(filePath: string): Promise<{
  path: string;
  wasConverted: boolean;
}> {
  if (needsConversion(filePath)) {
    const convertedPath = await convertToPng(filePath);
    return { path: convertedPath, wasConverted: true };
  }

  // Return original path if directly supported
  return { path: filePath, wasConverted: false };
}

/**
 * Clean up temporary files created during preprocessing
 */
export async function cleanupTempFile(filePath: string): Promise<void> {
  if (filePath.startsWith('/tmp/ai-classify-preprocess')) {
    await fs.unlink(filePath);
  }
}