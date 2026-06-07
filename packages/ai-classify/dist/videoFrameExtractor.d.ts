/**
 * AI Classify - Video Frame Extractor
 * Extracts key frames from video files for Ollama classification
 */
/**
 * Check if file is a video that needs frame extraction
 */
export declare function isVideo(filePath: string): boolean;
/**
 * Check if ffmpeg is available on the system
 */
export declare function checkFfmpegAvailable(): Promise<boolean>;
/**
 * Extract first frame from video file
 * @param filePath Video file path
 * @returns Path to extracted frame PNG (temporary)
 */
export declare function extractFrame(filePath: string): Promise<string>;
/**
 * Extract a representative frame from video (at 10% duration)
 * Use this when first frame might not be representative (e.g., black screen)
 */
export declare function extractRepresentativeFrame(filePath: string): Promise<string>;
/**
 * Clean up temporary frame file
 */
export declare function cleanupTempFile(filePath: string): Promise<void>;
//# sourceMappingURL=videoFrameExtractor.d.ts.map