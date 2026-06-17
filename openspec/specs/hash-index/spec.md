# Hash Index

## Purpose

The standalone CLI `.ai-classify-index.json` hash index is retired. The active system stores file identity and metadata in VFS/SQLite, keyed by content hash. This spec records that there are no active hash-index requirements outside VFS.

## Requirements

### Requirement: Standalone CLI hash index is not a supported store
The system SHALL NOT maintain a standalone CLI hash index file (such as `.ai-classify-index.json`) for duplicate detection or processing records.

#### Scenario: No external index file
- **WHEN** the system tracks processed media
- **THEN** it SHALL store identity, hash, and processing records in VFS/SQLite
- **AND** it SHALL NOT read or write a standalone CLI hash index file

#### Scenario: Replacement behavior in VFS
- **WHEN** the system needs duplicate detection, hash computation, index queries, or processing record fields (paths, capture time, category, AI filename, tags, confidence, model)
- **THEN** VFS hash-based save/list behavior and the VFS file metadata schema SHALL provide that capability
