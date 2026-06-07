## ADDED Requirements

### Requirement: React DevTools Panel
The system SHALL provide a React-based DevTools panel component.

#### Scenario: Panel renders correctly
- **WHEN** user opens Chrome DevTools
- **THEN** the Media Recorder panel SHALL render using React 18 components

#### Scenario: Panel initializes state
- **WHEN** panel mounts
- **THEN** the system SHALL initialize all state using React Hooks (useState, useEffect)

#### Scenario: Panel handles cleanup
- **WHEN** panel unmounts
- **THEN** the system SHALL cleanup intervals, listeners, and network connections

### Requirement: React Hooks for network listener
The system SHALL provide custom React hooks for network listener integration.

#### Scenario: useNetworkListener hook
- **WHEN** component uses useNetworkListener hook
- **THEN** the hook SHALL return network listener instance, capture state, and toggle function

#### Scenario: Hook cleanup on unmount
- **WHEN** component unmounts while capturing
- **THEN** the hook SHALL automatically stop listening

### Requirement: React Hooks for stats
The system SHALL provide custom React hooks for statistics management.

#### Scenario: useStats hook returns stats
- **WHEN** component uses useStats hook
- **THEN** the hook SHALL return image stats, video stats, and update function

#### Scenario: Stats auto-update
- **WHEN** capture is active
- **THEN** stats SHALL update every 1 second via useEffect interval

### Requirement: React Hooks for config
The system SHALL provide custom React hooks for configuration management.

#### Scenario: useConfig hook loads saved config
- **WHEN** component mounts
- **THEN** useConfig hook SHALL load saved config from Chrome Storage

#### Scenario: useConfig hook saves config
- **WHEN** user changes config value
- **THEN** useConfig hook SHALL save to Chrome Storage automatically

### Requirement: React i18n integration
The system SHALL integrate react-i18next for internationalization.

#### Scenario: i18n initialization
- **WHEN** app starts
- **THEN** i18n SHALL initialize with saved locale or browser language

#### Scenario: Language switching
- **WHEN** user selects different language
- **THEN** all UI text SHALL update immediately via react-i18next

#### Scenario: Locale persistence
- **WHEN** user changes language
- **THEN** locale preference SHALL save to Chrome Storage

### Requirement: CSS Modules styling
The system SHALL use CSS Modules for scoped styling.

#### Scenario: Styles are scoped
- **WHEN** component imports CSS Module
- **THEN** class names SHALL be automatically scoped to that component

#### Scenario: CSS variables work
- **WHEN** theme changes
- **THEN** CSS variables SHALL update colors across all components