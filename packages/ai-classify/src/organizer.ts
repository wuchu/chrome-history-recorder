/**
 * AI Classify - File Organizer
 */

import fs from 'fs-extra';
import path from 'path';
import { Config, ClassificationResult, IndexRecord } from './types.js';

export async function organizeFile(
  sourcePath: string,
  classification: ClassificationResult,
  config: Config,
  existingHash: string | null = null
): Promise<{ outputPath: string; hash: string }> {
  const ext = path.extname(sourcePath);

  // Determine target directory based on organization mode
  let targetDir: string;
  if (config.organizeBy === 'category') {
    targetDir = path.join(config.output, classification.category);
  } else {
    const today = new Date().toISOString().split('T')[0];
    targetDir = path.join(config.output, today);
  }

  // Ensure directory exists
  await fs.ensureDir(targetDir);

  // Generate target filename
  const targetName = sanitizeFilename(classification.suggestedName) + ext;
  let outputPath = path.join(targetDir, targetName);

  // Handle filename conflicts
  outputPath = await resolveConflict(outputPath);

  // Copy file (preserve source)
  await fs.copy(sourcePath, outputPath);

  // Preserve timestamps
  const stat = await fs.stat(sourcePath);
  await fs.utimes(outputPath, stat.atime, stat.mtime);

  // Compute hash for index
  const hash = existingHash || (await computeHash(sourcePath));

  return { outputPath, hash };
}

async function resolveConflict(outputPath: string): Promise<string> {
  if (!(await fs.pathExists(outputPath))) {
    return outputPath;
  }

  const dir = path.dirname(outputPath);
  const ext = path.extname(outputPath);
  const base = path.basename(outputPath, ext);

  // Try adding counter
  for (let i = 1; i <= 100; i++) {
    const newName = `${base}_${i}${ext}`;
    const newPath = path.join(dir, newName);
    if (!(await fs.pathExists(newPath))) {
      return newPath;
    }
  }

  // Fallback to timestamp
  const timestamp = Date.now();
  return path.join(dir, `${base}_${timestamp}${ext}`);
}

function sanitizeFilename(name: string): string {
  // Remove/replace invalid characters (including control characters)
  return (
    name
      // eslint-disable-next-line no-control-regex
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 100)
  ); // Limit length
}

async function computeHash(filePath: string): Promise<string> {
  const crypto = await import('crypto');
  const content = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function createIndexRecord(
  outputPath: string,
  category: string,
  originalPath: string
): IndexRecord {
  return {
    outputPath,
    processedAt: new Date().toISOString(),
    category,
    originalPath,
  };
}
