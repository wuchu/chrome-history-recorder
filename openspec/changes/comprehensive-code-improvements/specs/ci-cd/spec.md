## ADDED Requirements

### Requirement: GitHub Actions lint workflow
The project SHALL have a GitHub Actions workflow for linting.

#### Scenario: lint workflow exists
- **WHEN** the repository is set up
- **THEN** `.github/workflows/lint.yml` SHALL exist

#### Scenario: lint runs on push
- **WHEN** code is pushed to main or develop branches
- **THEN** the lint workflow SHALL run

#### Scenario: lint runs on pull request
- **WHEN** a pull request is created
- **THEN** the lint workflow SHALL run

### Requirement: GitHub Actions test workflow
The project SHALL have a GitHub Actions workflow for testing.

#### Scenario: test workflow exists
- **WHEN** the repository is set up
- **THEN** `.github/workflows/test.yml` SHALL exist

#### Scenario: test runs on push
- **WHEN** code is pushed to main or develop branches
- **THEN** the test workflow SHALL run

#### Scenario: test runs on pull request
- **WHEN** a pull request is created
- **THEN** the test workflow SHALL run

### Requirement: GitHub Actions build workflow
The project SHALL have a GitHub Actions workflow for building.

#### Scenario: build workflow exists
- **WHEN** the repository is set up
- **THEN** `.github/workflows/build.yml` SHALL exist

#### Scenario: build runs on pull request
- **WHEN** a pull request is created
- **THEN** the build workflow SHALL run

#### Scenario: build runs on release
- **WHEN** a release is published
- **THEN** the build workflow SHALL run