# Purpose

Ensure system-defined tabs are always visible in the tab bar, even when they have zero files, while preserving the existing behavior for user-defined tabs.

## Requirements

### Requirement: System tabs always visible in tab bar
The system SHALL display all system-defined tabs in the ScrollableTabBar component at all times, regardless of whether they have associated media files.

#### Scenario: Empty system tabs are displayed
- **WHEN** the extension has no media files or a system tag has zero files
- **THEN** the system tab still appears in the tab bar with a count of 0

#### Scenario: All system tabs are shown
- **WHEN** the extension is used
- **THEN** the following tabs are always visible: "全部", "📷 图片", "🎬 视频", "⭐ 已收藏", "未分类"

### Requirement: User tabs continue to show only when they have files
The system SHALL continue to display user-defined tabs only when they have one or more associated media files.

#### Scenario: User tab with files is shown
- **WHEN** a user-defined tag has one or more files
- **THEN** that tab appears in the tab bar

#### Scenario: User tab without files is hidden
- **WHEN** a user-defined tag has zero files
- **THEN** that tab does not appear in the tab bar

### Requirement: Tab counts are always displayed
The system SHALL display the file count on each tab, including when the count is 0.

#### Scenario: Zero count is displayed
- **WHEN** a system tab has zero files
- **THEN** the tab shows the label followed by "0"

#### Scenario: Non-zero count is displayed
- **WHEN** a tab has one or more files
- **THEN** the tab shows the label followed by the actual count

