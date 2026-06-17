# Spec: Extension AI Classify

## Purpose

Extension 内置的 AI 分类逻辑，直接调用 Ollama API，通过 VFS 更新元数据

## Requirements


### Requirement: Extension Background manages AI classification

The Extension Background Service Worker SHALL coordinate AI classification tasks by calling Ollama API and updating VFS metadata.

#### Scenario: Enqueue file for classification
- **WHEN** File is captured and saved to VFS
- **THEN** Background checks if file MIME type is image or video, and if so, calls VFS.enqueueClassification with hash

#### Scenario: Process classification task
- **WHEN** Classification scheduler finds pending task in queue
- **THEN** Background calls VFS.getFile to get buffer, calls Ollama API with image buffer and prompt, parses classification result, and calls VFS.updateMetadata with category, aiFilename, tags, confidence

#### Scenario: Handle classification failure
- **WHEN** Ollama API returns error or timeout
- **THEN** Background updates task status to 'failed', logs error message, and optionally retries after delay

#### Scenario: Classification result overwrites metadata
- **WHEN** AI classification completes for a file that already has metadata
- **THEN** Background overwrites category, aiFilename, tags, confidence fields (user-designed fields like is_starred, user_notes are preserved)

### Requirement: Extension Background provides classification queue management

The Extension Background Service Worker SHALL manage classification queue status and provide retry/clear operations.

#### Scenario: Get classification queue status
- **WHEN** DevTools Panel requests queue status
- **THEN** Background calls VFS.getQueueStatus and returns { pending, processing, completed, failed }

#### Scenario: Retry failed tasks
- **WHEN** User clicks "Retry Failed" in DevTools Panel
- **THEN** Background queries VFS for failed tasks, resets their status to 'pending', and triggers scheduler to process

#### Scenario: Clear queue
- **WHEN** User clicks "Clear Queue" in DevTools Panel
- **THEN** Background calls VFS to delete all queue entries

### Requirement: Extension Background calls Ollama directly

The Extension Background Service Worker SHALL call Ollama HTTP API directly for image/video classification.

#### Scenario: Call Ollama chat API with image
- **WHEN** Background processes classification task for image
- **THEN** Background POSTs to {ollamaEndpoint}/api/chat with { model, messages: [{ role: 'user', content: prompt, images: [base64] }], stream: false }

#### Scenario: Call Ollama chat API with video frame
- **WHEN** Background processes classification task for video
- **THEN** Background extracts first frame (calls VFS.getThumbnail for video), then calls Ollama API with frame image

#### Scenario: Parse classification result
- **WHEN** Ollama returns response with message.content
- **THEN** Background parses content in format "CATEGORY | FILENAME" or falls back to space-separated or JSON format

### Requirement: Extension Background checks Ollama health

The Extension Background Service Worker SHALL check Ollama service availability at startup and broadcast status to DevTools Panel.

#### Scenario: Check Ollama health at startup
- **WHEN** Extension Background Service Worker initializes
- **THEN** Background calls GET {ollamaEndpoint}/api/tags with timeout 5000ms, and sets ollamaAvailable flag

#### Scenario: Broadcast Ollama status
- **WHEN** Ollama health check completes
- **THEN** Background broadcasts { type: 'ollama:status', data: { available: true/false } } to DevTools Panel

#### Scenario: Handle Ollama unavailable
- **WHEN** Ollama health check fails
- **THEN** Background logs warning, continues file capture without classification, and DevTools Panel shows "Ollama unavailable" warning
