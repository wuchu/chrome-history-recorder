/**
 * AI Classify - Hash Index Management
 */

import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { HashIndex, IndexRecord } from './types.js';

const INDEX_FILE = 'index.json';

export async function computeFileHash(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  return hash;
}

export async function loadIndex(outputDir: string): Promise<HashIndex> {
  const indexPath = path.join(outputDir, INDEX_FILE);

  if (await fs.pathExists(indexPath)) {
    return await fs.readJson(indexPath);
  }

  return { processed: {} };
}

export async function saveIndex(outputDir: string, index: HashIndex): Promise<void> {
  const indexPath = path.join(outputDir, INDEX_FILE);
  await fs.writeJson(indexPath, index, { spaces: 2 });
}

export function hasBeenProcessed(index: HashIndex, hash: string): boolean {
  return hash in index.processed;
}

export function getProcessedRecord(index: HashIndex, hash: string): IndexRecord | undefined {
  return index.processed[hash];
}

export function addProcessedRecord(
  index: HashIndex,
  hash: string,
  record: IndexRecord
): HashIndex {
  index.processed[hash] = record;
  return index;
}

export async function clearIndex(outputDir: string): Promise<void> {
  const indexPath = path.join(outputDir, INDEX_FILE);
  if (await fs.pathExists(indexPath)) {
    await fs.unlink(indexPath);
  }
}