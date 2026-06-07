/**
 * AI Classify - Hash Index Management
 */
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
const INDEX_FILE = '.ai-classify-index.json';
export async function computeFileHash(filePath) {
    const content = await fs.readFile(filePath);
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    return hash;
}
export async function loadIndex(configDir) {
    const indexPath = path.join(configDir, INDEX_FILE);
    if (await fs.pathExists(indexPath)) {
        try {
            return await fs.readJson(indexPath);
        }
        catch (error) {
            // Handle corrupted index file - return empty index
            console.warn(`Warning: Corrupted index file, creating new empty index`);
            return { processed: {} };
        }
    }
    return { processed: {} };
}
export async function saveIndex(configDir, index) {
    const indexPath = path.join(configDir, INDEX_FILE);
    await fs.writeJson(indexPath, index, { spaces: 2 });
}
export function hasBeenProcessed(index, hash) {
    return hash in index.processed;
}
export function getProcessedRecord(index, hash) {
    return index.processed[hash];
}
export function addProcessedRecord(index, hash, record) {
    index.processed[hash] = record;
    return index;
}
export async function clearIndex(configDir) {
    const indexPath = path.join(configDir, INDEX_FILE);
    if (await fs.pathExists(indexPath)) {
        await fs.unlink(indexPath);
    }
}
//# sourceMappingURL=hashIndex.js.map