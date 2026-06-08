/**
 * AI Classify - Hash Index Utilities
 *
 * Provides hash computation and index lookup functions.
 * State persistence is handled by eventLog.ts.
 */

import fs from 'fs-extra';
import crypto from 'crypto';
import { HashIndex, IndexRecord } from './types.js';

/**
 * Compute SHA-256 hash of a file
 */
export async function computeFileHash(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Check if a hash has been processed
 */
export function hasBeenProcessed(index: HashIndex, hash: string): boolean {
  return hash in index.processed;
}

/**
 * Get processing record for a hash
 */
export function getProcessedRecord(index: HashIndex, hash: string): IndexRecord | undefined {
  return index.processed[hash];
}

/**
 * Add a processed record to the index (in-memory operation)
 */
export function addProcessedRecord(index: HashIndex, hash: string, record: IndexRecord): HashIndex {
  index.processed[hash] = record;
  return index;
}
