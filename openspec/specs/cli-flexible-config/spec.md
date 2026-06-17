# CLI Flexible Configuration

## Purpose

The standalone `ai-classify` CLI is retired. CLI flexible configuration (custom config-file paths, pure parameter mode, global options, prompt overrides, concurrency flags) is no longer supported. This spec records that there are no active CLI configuration requirements and points consumers to the supported workflow.

## Requirements

### Requirement: Standalone CLI configuration is not a supported surface
The system SHALL NOT expose standalone `ai-classify` CLI configuration modes (custom config file paths, pure parameter startup, global subcommand options, prompt override flags, CLI concurrency flags) as supported configuration surfaces.

#### Scenario: CLI flags are absent
- **WHEN** a user wants to configure capture, classification, prompts, or concurrency
- **THEN** the system SHALL direct them to Extension configuration in Chrome storage and DevTools controls instead of CLI flags

#### Scenario: Replacement controls in Extension and DevTools
- **WHEN** the user configures the supported workflow
- **THEN** the Extension Background SHALL load configuration from Chrome storage
- **AND** DevTools SHALL provide capture and classification controls
- **AND** Extension Background scheduler defaults SHALL govern concurrency and prompts
