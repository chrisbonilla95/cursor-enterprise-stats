# Change Log

All notable changes to the "Cursor Enterprise Stats" extension will be documented in this file.

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
