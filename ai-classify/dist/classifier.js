/**
 * AI Classify - Ollama Classifier
 */
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
const TEXT_EXTENSIONS = ['.txt', '.md', '.pdf'];
export async function checkOllamaHealth(config) {
    try {
        const response = await axios.get(`${config.ollamaEndpoint}/api/tags`, {
            timeout: 5000
        });
        return response.status === 200;
    }
    catch {
        return false;
    }
}
function isImage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
}
function isText(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return TEXT_EXTENSIONS.includes(ext);
}
async function classifyImage(filePath, config) {
    const imageBuffer = await fs.readFile(filePath);
    const base64Image = imageBuffer.toString('base64');
    const response = await axios.post(`${config.ollamaEndpoint}/api/chat`, {
        model: config.visionModel,
        messages: [
            {
                role: 'user',
                content: 'Analyze this image and provide: 1) A category (one word like: photo, screenshot, artwork, document, icon, meme), 2) A descriptive filename suggestion (without extension), 3) Tags (comma separated), 4) Confidence level (0-1). Format as JSON: {"category": "...", "suggestedName": "...", "tags": [...], "confidence": ...}',
                images: [base64Image]
            }
        ],
        stream: false
    }, {
        timeout: 60000
    });
    const content = response.data.message?.content || '';
    return parseClassificationResult(content);
}
async function classifyText(filePath, config) {
    const content = await fs.readFile(filePath, 'utf-8');
    const truncated = content.slice(0, 2000); // Limit text size
    const response = await axios.post(`${config.ollamaEndpoint}/api/chat`, {
        model: config.textModel,
        messages: [
            {
                role: 'user',
                content: `Analyze this text content and provide: 1) A category (one word like: document, code, notes, article, readme), 2) A descriptive filename suggestion (without extension), 3) Tags (comma separated), 4) Confidence level (0-1). Format as JSON: {"category": "...", "suggestedName": "...", "tags": [...], "confidence": ...}\n\nText content:\n${truncated}`
            }
        ],
        stream: false
    }, {
        timeout: 60000
    });
    const result = response.data.message?.content || '';
    return parseClassificationResult(result);
}
function parseClassificationResult(content) {
    // Try to extract JSON from response
    try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                category: parsed.category || 'unknown',
                suggestedName: parsed.suggestedName || 'unnamed',
                tags: parsed.tags || [],
                confidence: parsed.confidence || 0.5
            };
        }
    }
    catch {
        // Fallback to default
    }
    return {
        category: 'unknown',
        suggestedName: 'unnamed',
        tags: [],
        confidence: 0.1
    };
}
export async function classifyFile(filePath, config) {
    if (isImage(filePath)) {
        return classifyImage(filePath, config);
    }
    if (isText(filePath)) {
        return classifyText(filePath, config);
    }
    // Default classification for unknown file types
    return {
        category: 'other',
        suggestedName: path.basename(filePath, path.extname(filePath)),
        tags: [],
        confidence: 0.3
    };
}
//# sourceMappingURL=classifier.js.map