# CLI Experience

## Purpose

The standalone `ai-classify` CLI is retired. The supported product entry point for capture, classification, and progress monitoring is the Chrome Extension DevTools Panel. This spec records that there are no active CLI experience requirements and points consumers to the supported workflow.

## Requirements

### Requirement: Standalone CLI experience is not a supported surface
The system SHALL NOT expose a standalone `ai-classify` CLI experience (startup splash, terminal progress UI, terminal result cards, runtime keyboard interaction, configuration wizard, startup animations, ANSI styling) as a supported product surface.

#### Scenario: CLI surface is absent
- **WHEN** a user looks for a supported entry point to capture, classify, or monitor media
- **THEN** the system SHALL direct them to the Chrome Extension DevTools Panel and SHALL NOT provide an `ai-classify` CLI

#### Scenario: Replacement controls in DevTools
- **WHEN** the user wants progress, results, scheduler control, or model configuration
- **THEN** the DevTools Panel SHALL provide status, classification progress, media grid cards, scheduler controls (start, pause, retry failed, clear queue), and Ollama endpoint/model controls
