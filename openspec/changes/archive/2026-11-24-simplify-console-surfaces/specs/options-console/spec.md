## MODIFIED Requirements

### Requirement: Console navigation
The Options page SHALL present its content through five top-level sections — Overview (概览), Media Library (媒体库), Tags (标签), Tasks (任务), and Settings (设置) — reachable from a collapsible icon navigation rail.

#### Scenario: Render all console sections
- **WHEN** the user opens the Options page
- **THEN** the page SHALL render the five top-level navigation items
- **AND** the navigation rail SHALL default to the collapsed state showing icons only
- **AND** the Overview section SHALL be active by default

#### Scenario: Expand the navigation
- **WHEN** the user expands the navigation rail
- **THEN** it SHALL show both icons and section labels
- **AND** collapsing it again SHALL restore the icon-only rail

#### Scenario: Switch sections without a page reload
- **WHEN** the user selects a different console section
- **THEN** the page SHALL show that section's content without a full document reload

#### Scenario: Deep link to a section
- **WHEN** the Options page is opened with a supported section identifier — `#overview`, `#library`, `#tags`, `#tasks`, or `#settings` — or the legacy `#trash`
- **THEN** the page SHALL activate the matching section
- **AND** `#trash` SHALL activate the Media Library section with its trash view selected
- **AND** `#library?view=trash` SHALL activate the Media Library section with its trash view selected
- **AND** an unsupported or missing identifier SHALL fall back to the Overview section

#### Scenario: Preserve the active section across reload
- **WHEN** the user reloads the Options page while a non-default section is active
- **THEN** the page SHALL restore the same active section
- **AND** if the Media Library trash view was active, it SHALL restore the trash view

### Requirement: Media Library section availability
The Options page SHALL include a Media Library section that hosts the global media library capability, including its trash view.

#### Scenario: Open the library from the navigation
- **WHEN** the user selects the Media Library section
- **THEN** the page SHALL render the global media library defined by the `options-media-library` capability

#### Scenario: Open the trash view inside the library
- **WHEN** the user switches the Media Library view to 回收站
- **THEN** the page SHALL render the trash view defined by the `options-media-library` capability
- **AND** the Media Library navigation item SHALL remain active
- **AND** the page SHALL NOT render a separate Trash navigation item

#### Scenario: Library section contains no capture controls
- **WHEN** the Media Library section renders, in either the active or trash view
- **THEN** it SHALL NOT provide controls to start or stop a capture session

## REMOVED Requirements

### Requirement: Trash section
**Reason**: Trash is now a view inside the Media Library. A separate console section duplicated the media grid, selection mode, and detail view, and forced users to think of trashed media as a different kind of object.
**Migration**: Use the Media Library's 回收站 view switch. Existing `#trash` bookmarks and deep links resolve to that view. Restore, permanent delete, restore-all, and empty-trash remain available there.
