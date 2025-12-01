# Change Log

All notable changes to the "Cursor Enterprise Stats" extension will be documented in this file.

## [1.0.1] - 2025-12-01

### Changed
- **ESLint**: Migrated to `@gooddata/eslint-config` for stricter, enterprise-grade linting
- **Code Style**: Applied 2-space indentation and consistent formatting via Prettier
- **Interfaces**: Renamed to I-prefix convention (`IUsageSummaryResponse`, `IJwtPayload`)
- **Logging**: Replaced `console.log/error` with `process.stdout/stderr.write` for cleaner output

### Improved
- **Database Module**: Refactored `getCursorTokenFromDB` into smaller, focused helper functions to reduce cognitive complexity
- **Error Handling**: Use `isAxiosError()` helper for type-safe Axios error handling
- **Promise Handling**: Added `void` operator for fire-and-forget promises

### CI/CD
- Added `ci.yml` workflow for linting and type-checking on PRs and pushes to `main`
- Updated `release.yml` to run lint and type-check before packaging
- Enabled npm caching and added build timeouts

## [1.0.0] - 2025-12-01

### Initial Release

A streamlined VS Code extension for monitoring Cursor Enterprise usage.

#### Features
- 💰 **Status Bar Display**: Shows individual usage cost in real-time
- 📅 **Billing Cycle Info**: View billing cycle start and end dates with localized times
- 👤 **Individual Usage**: Track your personal usage in dollars
- 👥 **Team Pooled Usage**: Monitor team pooled limit, used, and remaining amounts with percentages
- 📊 **Contribution Tracking**: See your individual contribution to team pooled usage

#### Technical
- Single API endpoint integration (`/api/usage-summary`)
- Automatic token retrieval from Cursor database
- Support for large database files (>1.5GB) via SQLite CLI fallback
- Localized date/time formatting based on user's timezone
- Number formatting with commas for readability

### Acknowledgments
- Inspired by the original [Cursor Stats](https://github.com/Dwtexe/cursor-stats) extension by Dwtexe
