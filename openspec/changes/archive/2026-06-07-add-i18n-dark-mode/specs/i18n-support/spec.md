## ADDED Requirements

### Requirement: Language detection
The system SHALL detect the browser's UI language on initialization.

#### Scenario: Detect Chinese browser
- **WHEN** Chrome UI language is Chinese (zh-CN or zh)
- **THEN** the system SHALL display UI in Chinese

#### Scenario: Detect English browser
- **WHEN** Chrome UI language is English (en, en-US, en-GB)
- **THEN** the system SHALL display UI in English

#### Scenario: Unknown language fallback
- **WHEN** Chrome UI language is neither Chinese nor English
- **THEN** the system SHALL default to English

### Requirement: Manual language switching
The system SHALL allow users to manually switch language.

#### Scenario: Switch to Chinese
- **WHEN** user selects Chinese in language dropdown
- **THEN** the system SHALL update all UI text to Chinese

#### Scenario: Switch to English
- **WHEN** user selects English in language dropdown
- **THEN** the system SHALL update all UI text to English

#### Scenario: Persist language preference
- **WHEN** user selects a language
- **THEN** the system SHALL save the preference to Chrome Storage
- **AND** the preference SHALL persist across sessions

### Requirement: Language resources
The system SHALL provide complete translation resources for both languages.

#### Scenario: Chinese translations
- **WHEN** Chinese language is active
- **THEN** all UI text SHALL be displayed in Chinese

#### Scenario: English translations
- **WHEN** English language is active
- **THEN** all UI text SHALL be displayed in English

#### Scenario: Missing translation fallback
- **WHEN** a translation key is missing in the active language
- **THEN** the system SHALL fallback to the default language text