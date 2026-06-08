/**
 * AI Classify - Video Frame Extractor
 * Extracts key frames from video files for Ollama classification
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
const execAsync = promisify(exec);
const VIDEO_EXTENSIONS = ['.mp4'];
const TMP_DIR = '/tmp/ai-classify-preprocess';
/**
 * Check if file is a video that needs frame extraction
 */
export function isVideo(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return VIDEO_EXTENSIONS.includes(ext);
}
/**
 * Check if ffmpeg is available on the system
 */
export async function checkFfmpegAvailable() {
    try {
        await execAsync('ffmpeg -version', { timeout: 5000 });
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Extract first frame from video file
 * @param filePath Video file path
 * @returns Path to extracted frame PNG (temporary)
 */
export async function extractFrame(filePath) {
    await fs.ensureDir(TMP_DIR);
    const outputPath = path.join(TMP_DIR, `${uuidv4()}.png`);
    // Extract first frame using ffmpeg
    // -i: input file
    // -vf "select=eq(n\,0)": select frame 0 (first frame)
    // -frames:v 1: output only 1 frame
    // -y: overwrite output file
    const command = `ffmpeg -i "${filePath}" -vf "select=eq(n\\,0)" -frames:v 1 -y "${outputPath}"`;
    try {
        await execAsync(command, { timeout: 30000 });
        return outputPath;
    }
    catch {
        // If ffmpeg fails, try simpler extraction
        const fallbackCommand = `ffmpeg -i "${filePath}" -frames:v 1 -y "${outputPath}"`;
        await execAsync(fallbackCommand, { timeout: 30000 });
        return outputPath;
    }
}
/**
 * Extract a representative frame from video (at 10% duration)
 * Use this when first frame might not be representative (e.g., black screen)
 */
export async function extractRepresentativeFrame(filePath) {
    await fs.ensureDir(TMP_DIR);
    const outputPath = path.join(TMP_DIR, `${uuidv4()}.png`);
    // Get video duration first
    const probeCommand = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
    try {
        const { stdout } = await execAsync(probeCommand, { timeout: 10000 });
        const duration = parseFloat(stdout.trim());
        // Extract frame at 10% of duration (skip potential intro/black screens)
        const targetTime = duration * 0.1;
        const command = `ffmpeg -ss ${targetTime} -i "${filePath}" -frames:v 1 -y "${outputPath}"`;
        await execAsync(command, { timeout: 30000 });
        return outputPath;
    }
    catch {
        // Fallback to first frame extraction
        return extractFrame(filePath);
    }
}
/**
 * Clean up temporary frame file
 */
export async function cleanupTempFile(filePath) {
    if (filePath.startsWith(TMP_DIR)) {
        await fs.unlink(filePath);
    }
}
//# sourceMappingURL=videoFrameExtractor.js.map