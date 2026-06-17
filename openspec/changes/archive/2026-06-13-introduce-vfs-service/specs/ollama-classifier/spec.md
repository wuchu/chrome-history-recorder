## MODIFIED Requirements

### Requirement: Classifier calls Ollama API with image buffer

The Classifier SHALL call Ollama chat API with image buffer and return parsed classification result.

#### Scenario: Classify image with Ollama
- **WHEN** Classifier receives classifyFile(imagePath, config) call from Extension
- **THEN** Classifier reads image buffer (from VFS.getFile), builds base64, calls Ollama /api/chat, parses result, and returns ClassificationResult

#### Scenario: Parse pipe-separated result
- **WHEN** Ollama returns "猫咪 | 可爱的小猫"
- **THEN** Classifier returns { category: '猫咪', suggestedName: '可爱的小猫', tags: [], confidence: 0.8 }

#### Scenario: Parse space-separated result
- **WHEN** Ollama returns "cat cute_kitty"
- **THEN** Classifier returns { category: 'cat', suggestedName: 'cute_kitty', tags: [], confidence: 0.6 }

#### Scenario: Parse JSON result (fallback)
- **WHEN** Ollama returns JSON { "category": "cat", "suggestedName": "kitty" }
- **THEN** Classifier parses JSON and returns ClassificationResult

### Requirement: Classifier supports configurable prompt styles

The Classifier SHALL support configurable filename naming styles (auto, fun, sexy, artistic, poetic, minimal, professional, narrative) and custom prompts.

#### Scenario: Use default prompt style
- **WHEN** Config specifies filenameStyle: 'auto'
- **THEN** Classifier uses auto-style prompt: "Automatically choose the most appropriate style..."

#### Scenario: Use custom prompt
- **WHEN** Config specifies filenameStylePrompt: "Use emoji in filename"
- **THEN** Classifier uses custom prompt instead of preset

#### Scenario: Support multiple languages
- **WHEN** Config specifies language: 'zh-CN'
- **THEN** Classifier uses Chinese prompt template