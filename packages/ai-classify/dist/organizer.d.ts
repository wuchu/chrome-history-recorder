/**
 * AI Classify - File Organizer
 */
import { Config, ClassificationResult, IndexRecord } from './types.js';
export declare function organizeFile(sourcePath: string, classification: ClassificationResult, config: Config, existingHash?: string | null): Promise<{
    outputPath: string;
    hash: string;
}>;
export declare function createIndexRecord(outputPath: string, category: string, originalPath: string): IndexRecord;
//# sourceMappingURL=organizer.d.ts.map