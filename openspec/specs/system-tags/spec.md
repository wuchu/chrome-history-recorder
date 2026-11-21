# System Tags

## Purpose

Define immutable system tags and automatic assignment behavior for media records, while keeping system tags separate from user-defined tags.

## Requirements

### Requirement: System tag definitions
The system SHALL define immutable system tags.

#### Scenario: Predefined system tags
- **WHEN** the system initializes
- **THEN** the following system tags SHALL be available:
  - 📷 图片 (image): for image files
  - 🎬 视频 (video): for video files
  - ⭐ 已收藏 (starred): for starred files
  - 未分类 (uncategorized): for files with no user tags

#### Scenario: System tag immutability
- **WHEN** user views tag management UI
- **THEN** system tags SHALL be displayed as read-only
- **AND** user SHALL NOT be able to edit or delete system tags

### Requirement: Automatic system tag assignment
The system SHALL automatically assign system tags based on file metadata.

#### Scenario: Image/video tag on save
- **WHEN** a new file is saved
- **THEN** the system SHALL automatically add the "image" tag if mime_type starts with "image/"
- **AND** the system SHALL automatically add the "video" tag if mime_type starts with "video/"

#### Scenario: Starred tag sync
- **WHEN** a file's is_starred status changes
- **THEN** the system SHALL add the "starred" tag if is_starred = 1
- **AND** the system SHALL remove the "starred" tag if is_starred = 0

#### Scenario: Uncategorized tag
- **WHEN** a file has no user tags
- **THEN** the file SHALL be considered "uncategorized"
- **AND** the "未分类" tab SHALL include this file

### Requirement: System and user tag separation
The system SHALL store system tags and user tags separately.

#### Scenario: Separate storage fields
- **WHEN** tags are stored in the database
- **THEN** system tags SHALL be stored in a separate field from user tags
- **AND** both fields SHALL be JSON arrays

#### Scenario: Combined tag querying
- **WHEN** querying tags for display or filtering
- **THEN** the system SHALL combine system_tags and user_tags into a single logical list

### Requirement: Manual star toggle

The system SHALL let users mark any media item as starred or unstarred.

#### Scenario: Star an item
- **WHEN** the user stars a media item
- **THEN** the file's `is_starred` state SHALL be persisted
- **AND** the `system:starred` tag SHALL be added

#### Scenario: Unstar an item
- **WHEN** the user unstars a media item
- **THEN** the file's `is_starred` state SHALL be cleared
- **AND** the `system:starred` tag SHALL be removed
- **AND** other tags SHALL be preserved

#### Scenario: Star control is visible
- **WHEN** the user views an item in the grid or detail view
- **THEN** the item's current star state SHALL be visible
- **AND** the user SHALL be able to toggle it from the detail view

#### Scenario: Live update
- **WHEN** a file is starred or unstarred
- **THEN** the visible grid item and the detail view SHALL reflect the new state
- **AND** the starred filter result SHALL update without a full reload

#### Scenario: Starred tab
- **WHEN** the user opens the starred tag tab after starring an item
- **THEN** that item SHALL appear in the result
- **AND** unstarred items SHALL NOT appear

#### Scenario: System tag immutability
- **WHEN** the user views tag management
- **THEN** the starred system tag SHALL remain read-only
- **AND** the user SHALL NOT be able to rename, merge, or delete it
