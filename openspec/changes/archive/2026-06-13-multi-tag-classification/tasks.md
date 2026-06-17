## 1. Core Types and Configuration

- [x] 1.1 Add TagDefinition and update ExtensionConfig in extension-runtime.ts
- [x] 1.2 Add default userDefinedTags in config initialization
- [x] 1.3 Create tag utility functions (parse, combine system/user tags)

## 2. VFS Service Updates

- [x] 2.1 Update SQLite to support tag-based filtering in listFiles
- [x] 2.2 Add API to calculate tag usage counts
- [x] 2.3 Update FileMetadata interface for tag compatibility (already had tags field)
- [x] 2.4 Update updateMetadata to handle tags array (already handled)

## 3. AI Classifier Updates

- [x] 3.1 Update classifier prompt to include available tags and multi-tag format
- [x] 3.2 Update parseClassificationResult to extract multiple tags
- [x] 3.3 Add validation to filter tags against user-defined set
- [x] 3.4 Update ClassificationResult type to prioritize tags over category (kept for compatibility)

## 4. Options Page - Tag Management UI

- [x] 4.1 Create TagList UI (integrated in App.tsx)
- [x] 4.2 Create TagEditDialog component (integrated in App.tsx)
- [x] 4.3 Integrate tag management into Options page App.tsx
- [x] 4.4 Add save/load logic for userDefinedTags (added to config manager)
- [x] 4.5 Make system tags read-only in UI

## 5. DevTools Panel - Tag Filtering UI

- [x] 5.1 Create ScrollableTabBar component
- [x] 5.2 Replace MediaTabs with new tag-based ScrollableTabBar
- [x] 5.3 Implement tab state management (active tab, switching)
- [x] 5.4 Update useHistoricalImages hook to support tag filtering
- [x] 5.5 Add logic to compute which tags have files (in tag-utils)

## 6. Media Details Panel - Tag Display and Edit

- [x] 6.1 Update MediaDetail to display system and user tags
- [ ] 6.2 Add tag edit UI for user tags in MediaDetail
- [ ] 6.3 Add API calls to update file tags

## 7. Integration and Testing

- [ ] 7.1 End-to-end test: Create tags → Classify → Filter by tag
- [ ] 7.2 Verify system tags work correctly (image/video/starred/uncategorized)
- [ ] 7.3 Test backward compatibility with existing files
