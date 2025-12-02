# Change Log

All notable changes to the "Cursor Enterprise Stats" extension will be documented in this file.

## [1.1.0] - 2025-12-02

### Added
- **Leaderboard Integration**: Display your rank in the status bar alongside usage (e.g., "$314.71 • LoC #5")
- **Leaderboard Tooltip**: Detailed stats for last 30 days including:
  - Agent Lines of Code: rank, lines accepted, acceptance ratio, favorite model
  - Accepted Diffs: rank, total diffs accepted, favorite model
  - Tab Completions: rank, lines accepted, acceptance ratio, favorite model
- **Configurable Rank Display**: New setting `cursorEnterpriseStats.statusBarRankDisplay` to choose which leaderboard rank to show:
  - `agentLines` (default) - Agent Lines of Code rank
  - `acceptedDiffs` - Accepted Diffs rank
  - `tabCompletions` - Tab Completions rank
- **Local VSIX Packaging**: New `npm run package:vsix` script for creating local .vsix packages

### Improved
- **Performance**: Fetch usage summary and leaderboard data in parallel
- **Caching**: Cache user info, usage data, and leaderboard data to reduce API calls
- **Settings Reactivity**: Status bar updates immediately when rank display setting changes (no refresh needed)

### Technical
- Added `fetchUserInfo()` for `/api/dashboard/get-me` endpoint
- Added `fetchAllLeaderboards()` for team leaderboard data with all sort options
- Added `@vscode/vsce` dev dependency for extension packaging

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
