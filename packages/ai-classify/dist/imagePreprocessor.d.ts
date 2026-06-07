/**
 * AI Classify - Image Preprocessor
 * Converts unsupported image formats (webp) to png for Ollama compatibility
 */
/**
 * Check if image format needs conversion before sending to Ollama
 */
export declare function needsConversion(filePath: string): boolean;
/**
 * Check if image format is supported directly by Ollama
 */
export declare function isDirectlySupported(filePath: string): boolean;
/**
 * Convert image to PNG format
 * @param filePath Original file path
 * @returns Path to converted PNG file (temporary)
 */
export declare function convertToPng(filePath: string): Promise<string>;
/**
 * Preprocess image for Ollama compatibility
 * @param filePath Original file path
 * @returns Object with processed path and whether conversion occurred
 */
export declare function preprocessImage(filePath: string): Promise<{
    path: string;
    wasConverted: boolean;
}>;
/**
 * Clean up temporary files created during preprocessing
 */
export declare function cleanupTempFile(filePath: string): Promise<void>;
//# sourceMappingURL=imagePreprocessor.d.ts.map