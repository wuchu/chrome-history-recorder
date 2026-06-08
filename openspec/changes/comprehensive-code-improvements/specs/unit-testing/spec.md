## ADDED Requirements

### Requirement: Vitest configuration
The project SHALL have Vitest testing framework configured.

#### Scenario: Vitest config exists
- **WHEN** the project is initialized
- **THEN** a `vitest.config.ts` file SHALL exist in the root directory

#### Scenario: Vitest runs successfully
- **WHEN** developer runs `pnpm test`
- **THEN** Vitest SHALL execute all tests and report results

#### Scenario: Coverage report generated
- **WHEN** developer runs `pnpm test:coverage`
- **THEN** Vitest SHALL generate coverage report

### Requirement: Unit tests for ai-classify
The ai-classify module SHALL have unit tests for core functions.

#### Scenario: eventLog tests exist
- **WHEN** tests are run
- **THEN** tests for eventLog functions SHALL execute

#### Scenario: hashIndex tests exist
- **WHEN** tests are run
- **THEN** tests for hashIndex functions SHALL execute

#### Scenario: Tests pass
- **WHEN** all tests complete
- **THEN** no tests SHALL fail

### Requirement: Unit tests for proxy
The proxy module SHALL have unit tests for API endpoints.

#### Scenario: health endpoint test exists
- **WHEN** tests are run
- **THEN** test for `/health` endpoint SHALL execute

#### Scenario: save-image endpoint test exists
- **WHEN** tests are run
- **THEN** test for `/save-image` endpoint SHALL execute

### Requirement: Test scripts in package.json
The root package.json SHALL have test-related scripts.

#### Scenario: test script exists
- **WHEN** developer needs to run tests
- **THEN** `pnpm test` script SHALL be available

#### Scenario: test:coverage script exists
- **WHEN** developer needs coverage report
- **THEN** `pnpm test:coverage` script SHALL be available