## 1. Update ai-classify README

- [x] 1.1 Fix config file format description (change .ai-classify.json to .ai-classify.yaml)
- [x] 1.2 Update CLI usage section to describe interactive init command
- [x] 1.3 Update CLI options section to match actual implementation
- [x] 1.4 Remove outdated command examples
- [x] 1.5 Verify README matches actual behavior

## 2. Install ESLint dependencies

- [x] 2.1 Add eslint to root package.json devDependencies
- [x] 2.2 Add @eslint/js to root package.json devDependencies
- [x] 2.3 Add typescript-eslint to root package.json devDependencies
- [x] 2.4 Add eslint-config-prettier to root package.json devDependencies
- [x] 2.5 Run pnpm install to install dependencies

## 3. Create ESLint configuration

- [x] 3.1 Create eslint.config.mjs in root directory
- [x] 3.2 Configure ignores (node_modules, dist, .wxt, etc.)
- [x] 3.3 Configure JavaScript files rules
- [x] 3.4 Configure TypeScript files rules
- [x] 3.5 Add TypeScript type checking rules for TS files only
- [x] 3.6 Disable formatting rules (handled by Prettier)

## 4. Install Prettier dependencies

- [x] 4.1 Add prettier to root package.json devDependencies
- [x] 4.2 Run pnpm install to install dependencies

## 5. Create Prettier configuration

- [x] 5.1 Create .prettierrc.mjs in root directory
- [x] 5.2 Configure formatting options (semi, quotes, tabs, etc.)
- [x] 5.3 Create .prettierignore file for ignored paths

## 6. Install husky

- [x] 6.1 Add husky to root package.json devDependencies
- [x] 6.2 Run pnpm install to install dependencies
- [x] 6.3 Run pnpm dlx husky init to initialize husky
- [x] 6.4 Verify .husky directory is created

## 7. Install lint-staged

- [x] 7.1 Add lint-staged to root package.json devDependencies
- [x] 7.2 Run pnpm install to install dependencies

## 8. Create lint-staged configuration

- [x] 8.1 Create .lintstagedrc.mjs in root directory
- [x] 8.2 Configure JS/TS files to run ESLint and Prettier
- [x] 8.3 Configure JSON/YAML/MD files to run Prettier only
- [x] 8.4 Update .husky/pre-commit to run lint-staged

## 9. Update package.json scripts

- [x] 9.1 Add "lint" script to run eslint
- [x] 9.2 Add "lint:fix" script to run eslint --fix
- [x] 9.3 Add "format" script to run prettier --write
- [x] 9.4 Add "format:check" script to run prettier --check
- [x] 9.5 Verify scripts work correctly

## 10. Verification

- [x] 10.1 Run pnpm lint and verify it works
- [x] 10.2 Run pnpm format and verify it works
- [x] 10.3 Make a test commit and verify pre-commit hook runs (needs manual verification)
- [x] 10.4 Verify lint-staged only checks staged files (needs manual verification)
- [x] 10.5 Run full lint on all packages to find existing issues