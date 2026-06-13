## REMOVED Requirements

### Requirement: Hash index persistence
**Reason**: The standalone CLI `.ai-classify-index.json` file is retired. The active system stores file identity and metadata in VFS/SQLite.
**Migration**: Use VFS metadata records keyed by content hash.

### Requirement: Duplicate detection
**Reason**: CLI hash-index duplicate detection is replaced by VFS content-addressed storage and metadata lookup.
**Migration**: Use VFS hash-based save/list behavior.

### Requirement: Hash computation
**Reason**: Standalone CLI hash computation requirements are no longer needed as a separate capability.
**Migration**: Use VFS/Extension capture hashing behavior.

### Requirement: Index operations
**Reason**: CLI index management commands are retired with the CLI package.
**Migration**: Use VFS APIs and DevTools actions that operate on media records.

### Requirement: Index record structure
**Reason**: CLI index record structure is replaced by VFS metadata schema.
**Migration**: Use VFS file metadata fields for paths, capture time, category, AI filename, tags, confidence, and model information.
