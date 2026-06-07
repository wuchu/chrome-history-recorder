/**
 * AI Classify - Hash Index Management
 */

import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { HashIndex, IndexRecord } from './types.js';

const INDEX_FILE = '.ai-classify-index.json';

export async function computeFileHash(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  return hash;
}

export async function loadIndex(configDir: string): Promise<HashIndex> {
  const indexPath = path.join(configDir, INDEX_FILE);

  if (await fs.pathExists(indexPath)) {
    try {
      return await fs.readJson(indexPath);
    } catch (error) {
      // Handle corrupted index file - return empty index
      console.warn(`Warning: Corrupted index file, creating new empty index`);
      return { processed: {} };
    }
  }

  return { processed: {} };
}

export async function saveIndex(configDir: string, index: HashIndex): Promise<void> {
  const indexPath = path.join(configDir, INDEX_FILE);
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

export async function clearIndex(configDir: string): Promise<void> {
  const indexPath = path.join(configDir, INDEX_FILE);
  if (await fs.pathExists(indexPath)) {
    await fs.unlink(indexPath);
  }
}