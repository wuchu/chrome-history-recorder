/**
 * AI Classify - Ollama Classifier
 */
import { Config, ClassificationResult } from './types.js';
export declare function checkOllamaHealth(config: Config): Promise<boolean>;
export declare function classifyFile(filePath: string, config: Config): Promise<ClassificationResult>;
//# sourceMappingURL=classifier.d.ts.map