## ADDED Requirements

### Requirement: ESLint configuration
The project SHALL have a unified ESLint configuration using flat config format.

#### Scenario: ESLint config file exists
- **WHEN** the project is initialized
- **THEN** an `eslint.config.mjs` file SHALL exist in the root directory

#### Scenario: ESLint supports TypeScript
- **WHEN** ESLint runs on TypeScript files (*.ts, *.tsx)
- **THEN** ESLint SHALL apply TypeScript-specific rules

#### Scenario: ESLint supports JavaScript
- **WHEN** ESLint runs on JavaScript files (*.js, *.mjs)
- **THEN** ESLint SHALL apply JavaScript rules without type checking

#### Scenario: ESLint runs successfully
- **WHEN** developer runs `pnpm lint`
- **THEN** ESLint SHALL check all source files and report errors

### Requirement: Prettier configuration
The project SHALL have a unified Prettier configuration.

#### Scenario: Prettier config file exists
- **WHEN** the project is initialized
- **THEN** a `.prettierrc.mjs` file SHALL exist in the root directory

#### Scenario: Prettier formats code
- **WHEN** developer runs `pnpm format`
- **THEN** Prettier SHALL format all source files

#### Scenario: Prettier checks formatting
- **WHEN** developer runs `pnpm format:check`
- **THEN** Prettier SHALL check formatting without modifying files

### Requirement: Git hooks with husky
The project SHALL have pre-commit hooks using husky.

#### Scenario: husky is installed
- **WHEN** the project is initialized
- **THEN** husky SHALL be installed and `.husky/` directory SHALL exist

#### Scenario: pre-commit hook runs lint-staged
- **WHEN** developer commits changes
- **THEN** lint-staged SHALL run ESLint and Prettier on staged files

#### Scenario: commit blocked on lint errors
- **WHEN** lint-staged finds errors
- **THEN** the commit SHALL be blocked
- **AND** error messages SHALL be displayed

### Requirement: lint-staged configuration
The project SHALL have lint-staged configuration for efficient pre-commit checks.

#### Scenario: lint-staged config exists
- **WHEN** the project is initialized
- **THEN** a `.lintstagedrc.mjs` file SHALL exist in the root directory

#### Scenario: lint-staged runs on staged files only
- **WHEN** developer commits changes
- **THEN** lint-staged SHALL only check files that are staged for commit

#### Scenario: lint-staged fixes errors automatically
- **WHEN** lint-staged finds fixable errors
- **THEN** lint-staged SHALL automatically fix the errors
- **AND** the fixed files SHALL be re-staged

### Requirement: Package.json scripts
The root package.json SHALL have lint-related scripts.

#### Scenario: lint script exists
- **WHEN** developer needs to check code quality
- **THEN** `pnpm lint` script SHALL be available

#### Scenario: format script exists
- **WHEN** developer needs to format code
- **THEN** `pnpm format` script SHALL be available

#### Scenario: format:check script exists
- **WHEN** developer needs to check formatting without modifying
- **THEN** `pnpm format:check` script SHALL be available

#### Scenario: lint:fix script exists
- **WHEN** developer needs to auto-fix lint errors
- **THEN** `pnpm lint:fix` script SHALL be available

### Requirement: Documentation accuracy
The ai-classify README SHALL accurately describe the actual implementation.

#### Scenario: Config file format documented correctly
- **WHEN** user reads README
- **THEN** README SHALL describe `.ai-classify.yaml` as the config file format

#### Scenario: CLI usage documented correctly
- **WHEN** user reads README
- **THEN** README SHALL describe `ai-classify init` interactive configuration

#### Scenario: CLI options documented correctly
- **WHEN** user reads README
- **THEN** README SHALL list the actual available CLI options