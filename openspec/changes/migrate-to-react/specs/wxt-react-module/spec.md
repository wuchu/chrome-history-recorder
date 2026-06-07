## ADDED Requirements

### Requirement: WXT React module configuration
The system SHALL configure WXT to use React instead of Vue.

#### Scenario: React module is loaded
- **WHEN** WXT builds the extension
- **THEN** @wxt-dev/module-react SHALL be loaded and configured

#### Scenario: Vue module is removed
- **WHEN** migrating to React
- **THEN** @wxt-dev/module-vue SHALL be removed from configuration

### Requirement: React entrypoint structure
The system SHALL structure React entrypoints according to WXT conventions.

#### Scenario: DevTools panel entrypoint
- **WHEN** WXT processes entrypoints
- **THEN** devtools-panel/main.tsx SHALL be recognized as React entrypoint

#### Scenario: HTML template generation
- **WHEN** WXT builds for production
- **THEN** devtools-panel.html SHALL be generated with React mount point

### Requirement: React dependencies
The system SHALL include all necessary React dependencies.

#### Scenario: Core React packages
- **WHEN** package.json is configured
- **THEN** react and react-dom SHALL be included as dependencies

#### Scenario: React module package
- **WHEN** package.json is configured
- **THEN** @wxt-dev/module-react SHALL be included as devDependency

#### Scenario: React i18n package
- **WHEN** package.json is configured
- **THEN** react-i18next and i18next SHALL be included as dependencies

### Requirement: TypeScript configuration for React
The system SHALL configure TypeScript for React development.

#### Scenario: JSX is supported
- **WHEN** TypeScript compiles .tsx files
- **THEN** JSX syntax SHALL be correctly transpiled

#### Scenario: React types are available
- **WHEN** TypeScript checks types
- **THEN** @types/react and @types/react-dom types SHALL be available