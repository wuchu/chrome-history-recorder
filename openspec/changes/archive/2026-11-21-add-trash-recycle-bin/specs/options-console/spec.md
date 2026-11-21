## MODIFIED Requirements

### Requirement: Console navigation
The Options page SHALL present its content through six top-level sections — Overview (概览), Media Library (媒体库), Tags (标签), Tasks (任务), Trash (回收站), and Settings (设置) — reachable from a collapsible icon navigation rail.

#### Scenario: Render all console sections
- **WHEN** the user opens the Options page
- **THEN** the page SHALL render the six top-level navigation items
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
- **WHEN** the Options page is opened with a supported section identifier in its URL, including `#trash`
- **THEN** the page SHALL activate that section
- **AND** an unsupported or missing identifier SHALL fall back to the Overview section

#### Scenario: Preserve the active section across reload
- **WHEN** the user reloads the Options page while a non-default section is active
- **THEN** the page SHALL restore the same active section

## ADDED Requirements

### Requirement: Trash section

The Options page SHALL include a Trash section that hosts the recycle-bin capability as a first-class navigation destination.

#### Scenario: Open the Trash section
- **WHEN** the user selects the Trash section or opens `#trash`
- **THEN** the page SHALL render the Trash page defined by the `trash-management` capability
- **AND** it SHALL show the trashed media count and storage size

#### Scenario: Trash section actions
- **WHEN** the Trash section renders with trashed files
- **THEN** it SHALL provide a restore action per item, a permanent delete action per item, a restore-all action, and an empty-trash action
- **AND** permanent deletion and emptying SHALL require explicit confirmation that the data cannot be recovered

#### Scenario: Empty trash state
- **WHEN** no files are in the trash
- **THEN** the Trash section SHALL show an empty state
- **AND** the restore-all and empty-trash actions SHALL be disabled

#### Scenario: Trash section contains no capture controls
- **WHEN** the Trash section renders
- **THEN** it SHALL NOT provide controls to start or stop a capture session
