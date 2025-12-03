# Cursor Enterprise Stats

<div align="center">

> A simple Cursor extension for monitoring enterprise usage.

</div>

## ✨ Features

- 📊 **Status Bar** - Shows your individual usage in dollars with leaderboard rank (e.g., "$314.71 • LoC #5")
- 📅 **Billing Cycle** - Start and end dates with times (localized to your timezone)
- 👤 **Individual Usage** - Your personal usage, contribution percentage, and favorite AI model
- 👥 **Team Pooled Usage** - Limit, used, and remaining with percentages
- 🏆 **Leaderboard Stats** - Configurable date range rankings for Agent Lines, Accepted Diffs, and Tab Completions
- 🔄 **Auto-refresh** - Updates every 60 seconds

## ⚙️ Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `cursorEnterpriseStats.enableLogging` | Enable detailed logging for debugging | `true` |
| `cursorEnterpriseStats.customDatabasePath` | Custom path to Cursor database file | `""` |
| `cursorEnterpriseStats.enableLeaderboard` | Enable leaderboard stats, rank display, and favorite model | `true` |
| `cursorEnterpriseStats.leaderboardDateRange` | Number of days for leaderboard stats (data available for Cursor v1.5+) | `30` |
| `cursorEnterpriseStats.statusBarRankDisplay` | Which leaderboard rank to show: `agentLines`, `acceptedDiffs`, or `tabCompletions` | `agentLines` |

## 🔧 Commands

| Command | Description |
|---------|-------------|
| `cursor-enterprise-stats.refresh` | Manually refresh statistics |
| `cursor-enterprise-stats.openSettings` | Open extension settings |

## 🚀 Installation

### Manual Installation

1. Download the latest `.vsix` from [Releases](https://github.com/chrisbonilla95/cursor-enterprise-stats/releases)
2. Open Cursor
3. Press `Ctrl+Shift+P` / `⌘⇧P`
4. Run `Extensions: Install from VSIX...`
5. Select the downloaded file

## 🙏 Acknowledgments

This extension was inspired by the original [cursor-stats](https://github.com/Dwtexe/cursor-stats) by [Dwtexe](https://github.com/Dwtexe). Thank you for the foundation!

## 📄 License

[MIT](LICENSE)

---

<div align="center">

Made by [chrisbonilla95](https://github.com/chrisbonilla95)

</div>
