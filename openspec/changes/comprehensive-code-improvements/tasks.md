## 1. ESLint Issues - High Priority Errors

- [x] 1.1 Fix no-case-declarations in cli.ts (wrap case block declarations)
- [x] 1.2 Fix no-empty in cli.ts (remove or add comment for empty catch)
- [x] 1.3 Fix no-control-regex in organizer.ts (escape control characters properly)
- [x] 1.4 Fix no-useless-escape in classifier.ts (remove unnecessary escape)
- [x] 1.5 Fix no-useless-catch in networkListener.ts (remove useless try/catch wrapper)
- [x] 1.6 Fix prefer-const violations (change let to const where appropriate)
- [x] 1.7 Verify all errors are resolved

## 2. ESLint Issues - Warnings (Unused Variables)

- [x] 2.1 Remove unused imports in ai-classify/cli.ts
- [x] 2.2 Remove unused imports in ai-classify/src/index.ts
- [x] 2.3 Remove unused imports in ai-classify/src/cli.ts
- [x] 2.4 Remove unused imports in extension/App.tsx
- [x] 2.5 Fix unused variables with underscore prefix where needed
- [x] 2.6 Remove unused function getExtensionFromUrl in proxy/server.js
- [x] 2.7 Verify all unused-var warnings are resolved

## 3. ESLint Issues - Warnings (any Types)

- [x] 3.1 Replace any with specific types in cli.ts
- [x] 3.2 Replace any with specific types in config.ts
- [x] 3.3 Replace any with specific types in index.ts
- [x] 3.4 Replace any with specific types in videoFrameExtractor.ts
- [x] 3.5 Replace any with specific types in networkListener.ts
- [x] 3.6 Use unknown or specific types where any is unavoidable
- [x] 3.7 Verify all no-explicit-any warnings are resolved or justified

## 4. Proxy TypeScript Migration - Setup

- [x] 4.1 Add TypeScript and @types/node to proxy package.json
- [x] 4.2 Add @types/express, @types/cors, @types/pino to proxy package.json
- [x] 4.3 Create tsconfig.json for proxy module
- [x] 4.4 Update proxy package.json scripts for TypeScript
- [x] 4.5 Run pnpm install to install dependencies

## 5. Proxy TypeScript Migration - File Conversion

- [x] 5.1 Rename src/logger.js to src/logger.ts
- [x] 5.2 Rename src/server.js to src/server.ts
- [x] 5.3 Rename src/routes/debug.js to src/routes/debug.ts
- [x] 5.4 Add type definitions for Express middleware
- [x] 5.5 Add type definitions for request/response
- [x] 5.6 Fix TypeScript compilation errors
- [x] 5.7 Verify proxy builds successfully with TypeScript

## 6. Vitest Setup

- [x] 6.1 Add vitest to root package.json devDependencies
- [x] 6.2 Add @vitest/coverage-v8 to root package.json devDependencies
- [x] 6.3 Create vitest.config.ts in root directory
- [x] 6.4 Add test and test:coverage scripts to package.json
- [x] 6.5 Run pnpm install to install dependencies

## 7. Vitest Tests - ai-classify

- [x] 7.1 Create test file for eventLog.ts (tests for appendEvent, loadState, compact)
- [x] 7.2 Create test file for hashIndex.ts (tests for computeFileHash, hasBeenProcessed)
- [x] 7.3 Create test file for config.ts (tests for loadConfig, saveConfig)
- [x] 7.4 Verify ai-classify tests pass

## 8. Vitest Tests - proxy

- [x] 8.1 Create test file for server utility functions (path validation, MIME type mapping)
- [x] 8.2 Create mock concepts for ring buffer behavior
- [x] 8.3 Verify proxy tests pass

## 9. GitHub Actions - Setup

- [x] 9.1 Create .github/workflows directory
- [x] 9.2 Create lint.yml workflow
- [x] 9.3 Create test.yml workflow
- [x] 9.4 Create build.yml workflow

## 10. Verification

- [x] 10.1 Run pnpm lint and verify no errors
- [x] 10.2 Run pnpm test and verify tests pass
- [x] 10.3 Run pnpm build and verify all packages build
- [x] 10.4 Verify proxy TypeScript migration complete
- [x] 10.5 Commit changes and verify CI workflows run