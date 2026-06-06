/**
 * AI Classify - Hash Index Management
 */
import { HashIndex, IndexRecord } from './types.js';
export declare function computeFileHash(filePath: string): Promise<string>;
export declare function loadIndex(outputDir: string): Promise<HashIndex>;
export declare function saveIndex(outputDir: string, index: HashIndex): Promise<void>;
export declare function hasBeenProcessed(index: HashIndex, hash: string): boolean;
export declare function getProcessedRecord(index: HashIndex, hash: string): IndexRecord | undefined;
export declare function addProcessedRecord(index: HashIndex, hash: string, record: IndexRecord): HashIndex;
export declare function clearIndex(outputDir: string): Promise<void>;
//# sourceMappingURL=hashIndex.d.ts.map