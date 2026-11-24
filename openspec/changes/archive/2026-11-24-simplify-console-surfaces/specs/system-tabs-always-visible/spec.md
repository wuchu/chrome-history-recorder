## REMOVED Requirements

### Requirement: System tabs always visible in tab bar
**Reason**: The media library no longer renders a tag tab bar. System filters (all, image, video, starred, uncategorized) remain available as query tokens and search suggestions.
**Migration**: Use `type:image`, `type:video`, `starred`, or `tag:uncategorized` in the unified search bar, or select the equivalent suggestion. No system filter loses coverage.

### Requirement: User tabs continue to show only when they have files
**Reason**: User tags are no longer rendered as tabs; tag discovery happens through search suggestions, which list tags with their usage counts.
**Migration**: Type `tag:` or a tag-like term to see matching tags; tags without files remain listed in the vocabulary but do not affect the media grid until selected.

### Requirement: Tab counts are always displayed
**Reason**: There is no tab bar to display counts on. Tag usage counts remain available in search suggestions and in the Tags section.
**Migration**: Use tag suggestions to see per-tag usage counts, or open the Tags section for the full vocabulary.
