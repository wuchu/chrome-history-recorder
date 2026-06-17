## MODIFIED Requirements

### Requirement: 项目渲染

虚拟 Masonry 网格 SHALL render each media item with lazy-loaded thumbnails, classification status, metadata badges, and click behavior. For the main Masonry grid, image thumbnail sources MUST provide at least a 2:1 source-pixel to target-column-width ratio; with the default 200px target column width, the grid SHALL use the existing `large` thumbnail size whose longest edge is 400px.

#### Scenario: Render grid thumbnail at high-density source size
- **WHEN** the virtual Masonry grid renders an image item in the default 200px target column layout
- **THEN** the thumbnail image SHALL load from a `large` thumbnail source with a 400px longest edge
- **AND** the thumbnail SHALL be rendered with `<img loading="lazy" />`

#### Scenario: Render item classification metadata
- **WHEN** a virtual Masonry grid item has classification status, category, confidence, or tags
- **THEN** the item SHALL display StatusBadge for pending/processing/completed/failed states
- **AND** the item SHALL display category, confidence progress, and tags when those values are available

#### Scenario: Open detail panel from grid item
- **WHEN** the user clicks a virtual Masonry grid item
- **THEN** the DevTools Panel SHALL open the MediaDetail panel for that item
