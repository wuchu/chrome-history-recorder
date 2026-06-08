/**
 * AI Classify - Hash Index Utilities
 *
 * Provides hash computation and index lookup functions.
 * State persistence is handled by eventLog.ts.
 */
import { HashIndex, IndexRecord } from './types.js';
/**
 * Compute SHA-256 hash of a file
 */
export declare function computeFileHash(filePath: string): Promise<string>;
/**
 * Check if a hash has been processed
 */
export declare function hasBeenProcessed(index: HashIndex, hash: string): boolean;
/**
 * Get processing record for a hash
 */
export declare function getProcessedRecord(index: HashIndex, hash: string): IndexRecord | undefined;
/**
 * Add a processed record to the index (in-memory operation)
 */
export declare function addProcessedRecord(index: HashIndex, hash: string, record: IndexRecord): HashIndex;
//# sourceMappingURL=hashIndex.d.ts.map