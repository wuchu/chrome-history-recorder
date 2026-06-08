## REMOVED Requirements

### Requirement: Text classification
**Reason**: 仅处理媒体文件（图片和视频），文本文件将被跳过
**Migration**: 文本文件不再进入队列，直接在 watcher 层被过滤

## MODIFIED Requirements

### Requirement: Model configuration
The system SHALL allow users to configure the AI model.

#### Scenario: Specify vision model
- **WHEN** user configures a specific vision model name
- **THEN** the system SHALL use that model for image and video classification

#### Scenario: Default vision model selection
- **WHEN** no vision model is configured
- **THEN** the system SHALL use llava for images and videos