import * as vscode from 'vscode';

import {
  type IGetMeResponse,
  type ILeaderboardData,
  type IUsageSummaryResponse,
  calculateIndividualContribution,
  formatCentsToDollars,
} from '../services/api.js';
import { log } from '../utils/logger.js';

let statusBarItem: vscode.StatusBarItem;

export function createStatusBarItem(): vscode.StatusBarItem {
  log('[Status Bar] Creating status bar item...');
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  log('[Status Bar] Status bar alignment: Right, Priority: 100');
  return statusBarItem;
}

/**
 * Format a date string to a full readable format with time, localized to user's timezone
 * Uses user's locale preferences for date/time format
 */
function formatFullDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Configuration type for rank display
type RankDisplayOption = 'agentLines' | 'acceptedDiffs' | 'tabCompletions';

/**
 * Format large numbers with commas (e.g., 55472 to "55,472")
 */
function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Format a ratio as percentage (e.g., 0.5568 to "55.7%")
 */
function formatPercent(ratio: number): string {
  return (ratio * 100).toFixed(1) + '%';
}

/**
 * Format a date range in user's locale
 * If same year, omits year from start date (e.g., "3.10 - 31.12" or "10/3 - 12/31")
 * If different years, shows full dates (e.g., "3.12.2024 - 2.12.2025" or "12/3/2024 - 12/2/2025")
 */
function formatDateRange(days: number): string {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const sameYear = startDate.getFullYear() === endDate.getFullYear();

  if (sameYear) {
    // Short format without year
    const startStr = startDate.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
    const endStr = endDate.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
    return `${startStr} - ${endStr}`;
  } else {
    // Full format with year
    const startStr = startDate.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    const endStr = endDate.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    return `${startStr} - ${endStr}`;
  }
}

/**
 * Get the configured rank display option
 */
function getRankDisplayOption(): RankDisplayOption {
  const config = vscode.workspace.getConfiguration('cursorEnterpriseStats');
  return config.get<RankDisplayOption>('statusBarRankDisplay') ?? 'agentLines';
}

/**
 * Get favorite model from the leaderboard matching the status bar display config
 */
function getFavoriteModel(leaderboardData: ILeaderboardData | null): string | null {
  if (!leaderboardData) {
    return null;
  }

  const displayOption = getRankDisplayOption();

  if (displayOption === 'agentLines') {
    return leaderboardData.agentLines.userEntry?.favorite_model ?? null;
  }

  if (displayOption === 'acceptedDiffs') {
    return leaderboardData.acceptedDiffs.userEntry?.favorite_model ?? null;
  }

  if (displayOption === 'tabCompletions') {
    return leaderboardData.tabCompletions.userEntry?.favorite_model ?? null;
  }

  return null;
}

/**
 * Build the rank display string for the status bar
 */
function buildRankDisplay(leaderboardData: ILeaderboardData | null): string {
  if (!leaderboardData) {
    return '';
  }

  const displayOption = getRankDisplayOption();

  if (displayOption === 'agentLines') {
    const entry = leaderboardData.agentLines.userEntry;
    if (entry) {
      return ` • LoC #${entry.rank}`;
    }
  }

  if (displayOption === 'acceptedDiffs') {
    const entry = leaderboardData.acceptedDiffs.userEntry;
    if (entry) {
      return ` • AD #${entry.rank}`;
    }
  }

  if (displayOption === 'tabCompletions') {
    const entry = leaderboardData.tabCompletions.userEntry;
    if (entry) {
      return ` • TC #${entry.rank}`;
    }
  }

  return '';
}

/**
 * Update the status bar with usage summary data
 */
export function updateStatusBar(
  data: IUsageSummaryResponse,
  leaderboardData: ILeaderboardData | null,
  userInfo: IGetMeResponse | null,
): void {
  const individualUsed = data.individualUsage.overall.used;
  const formattedUsage = formatCentsToDollars(individualUsed);
  const rankDisplay = buildRankDisplay(leaderboardData);

  // Set the status bar text with rank
  statusBarItem.text = `$(pulse) ${formattedUsage}${rankDisplay}`;

  // Create the tooltip
  statusBarItem.tooltip = createTooltip(data, leaderboardData, userInfo);

  log(`[Status Bar] Updated: ${formattedUsage}${rankDisplay}`);
}

/**
 * Append leaderboard section to tooltip
 */
function appendLeaderboardSection(
  tooltip: vscode.MarkdownString,
  leaderboardData: ILeaderboardData,
): void {
  const config = vscode.workspace.getConfiguration('cursorEnterpriseStats');
  const days = config.get<number>('leaderboardDateRange') ?? 30;
  const dateRange = formatDateRange(days);
  tooltip.appendMarkdown('---\n\n');
  tooltip.appendMarkdown(`### 🏆 Leaderboard (Last ${days} Days)\n\n`);
  tooltip.appendMarkdown(`📅 ${dateRange}\n\n`);

  // Agent Lines of Code (PRIMARY)
  const agentLines = leaderboardData.agentLines;
  if (agentLines.userEntry) {
    const entry = agentLines.userEntry;
    tooltip.appendMarkdown('**Agent Lines of Code**\n\n');
    tooltip.appendMarkdown(`🥇 Rank: **#${entry.rank}** of ${agentLines.totalUsers}\n\n`);
    tooltip.appendMarkdown(
      `Lines: ${formatNumber(entry.total_composer_lines_accepted)} accepted\n\n`,
    );
    tooltip.appendMarkdown(
      `Acceptance: ${formatPercent(entry.composer_line_acceptance_ratio)}\n\n`,
    );
  } else {
    tooltip.appendMarkdown('**Agent Lines of Code:** Unranked\n\n');
  }

  // Accepted Diffs
  const acceptedDiffs = leaderboardData.acceptedDiffs;
  if (acceptedDiffs.userEntry) {
    const entry = acceptedDiffs.userEntry;
    tooltip.appendMarkdown('**Accepted Diffs**\n\n');
    tooltip.appendMarkdown(`🥇 Rank: **#${entry.rank}** of ${acceptedDiffs.totalUsers}\n\n`);
    tooltip.appendMarkdown(`Diffs: ${formatNumber(entry.total_diff_accepts)} accepted\n\n`);
  } else {
    tooltip.appendMarkdown('**Accepted Diffs:** Unranked\n\n');
  }

  // Tab Completions
  const tabCompletions = leaderboardData.tabCompletions;
  if (tabCompletions.userEntry) {
    const entry = tabCompletions.userEntry;
    tooltip.appendMarkdown('**Tab Completions**\n\n');
    tooltip.appendMarkdown(`🥇 Rank: **#${entry.rank}** of ${tabCompletions.totalUsers}\n\n`);
    tooltip.appendMarkdown(`Lines: ${formatNumber(entry.total_tab_lines_accepted)} accepted\n\n`);
    tooltip.appendMarkdown(`Acceptance: ${formatPercent(entry.tab_line_acceptance_ratio)}\n\n`);
  } else {
    tooltip.appendMarkdown('**Tab Completions:** Unranked\n\n');
  }
}

/**
 * Create a markdown tooltip with usage details
 */
function createTooltip(
  data: IUsageSummaryResponse,
  leaderboardData: ILeaderboardData | null,
  _userInfo: IGetMeResponse | null,
): vscode.MarkdownString {
  const tooltip = new vscode.MarkdownString();
  tooltip.isTrusted = true;
  tooltip.supportHtml = true;
  tooltip.supportThemeIcons = true;

  // Billing Cycle
  const cycleStart = formatFullDateTime(data.billingCycleStart);
  const cycleEnd = formatFullDateTime(data.billingCycleEnd);
  tooltip.appendMarkdown('### 📅 Billing Cycle\n\n');
  tooltip.appendMarkdown(`**Start:** ${cycleStart}\n\n`);
  tooltip.appendMarkdown(`**End:** ${cycleEnd}\n\n`);

  // Individual Usage
  const individualUsed = data.individualUsage.overall.used;
  tooltip.appendMarkdown('---\n\n');
  tooltip.appendMarkdown('### 👤 Individual Usage\n\n');
  tooltip.appendMarkdown(`**Used:** ${formatCentsToDollars(individualUsed)}\n\n`);

  // Show contribution percentage under individual usage if team pooled is enabled
  if (data.teamUsage?.pooled?.enabled && data.teamUsage.pooled.used > 0) {
    const contribution = calculateIndividualContribution(
      individualUsed,
      data.teamUsage.pooled.used,
    );
    tooltip.appendMarkdown(
      `**Your Contribution:** ${contribution.toFixed(1)}% of team pooled usage\n\n`,
    );
  }

  // Show favorite model (from whichever leaderboard is configured for status bar)
  const favoriteModel = getFavoriteModel(leaderboardData);
  if (favoriteModel) {
    tooltip.appendMarkdown(`**Favorite Model:** ${favoriteModel}\n\n`);
  }

  // Pooled Usage (Team)
  if (data.teamUsage?.pooled?.enabled) {
    const pooled = data.teamUsage.pooled;
    const pooledUsed = pooled.used;
    const pooledLimit = pooled.limit;
    const pooledRemaining = pooled.remaining;

    // Calculate percentages
    const usedPercent = pooledLimit > 0 ? ((pooledUsed / pooledLimit) * 100).toFixed(1) : '0.0';
    const remainingPercent =
      pooledLimit > 0 ? ((pooledRemaining / pooledLimit) * 100).toFixed(1) : '0.0';

    tooltip.appendMarkdown('---\n\n');
    tooltip.appendMarkdown('### 👥 Pooled Usage (Team)\n\n');
    tooltip.appendMarkdown(`**Limit:** ${formatCentsToDollars(pooledLimit)}\n\n`);
    tooltip.appendMarkdown(`**Used:** ${formatCentsToDollars(pooledUsed)} (${usedPercent}%)\n\n`);
    tooltip.appendMarkdown(
      `**Remaining:** ${formatCentsToDollars(pooledRemaining)} (${remainingPercent}%)\n\n`,
    );
  }

  // Leaderboard Stats
  if (leaderboardData) {
    appendLeaderboardSection(tooltip, leaderboardData);
  }

  // Footer with last updated time
  tooltip.appendMarkdown('---\n\n');
  tooltip.appendMarkdown('<div align="center">\n\n');
  const now = new Date().toLocaleTimeString();
  tooltip.appendMarkdown(`🔄 [Refresh](command:cursor-enterprise-stats.refresh) • 🕒 ${now}\n\n`);
  tooltip.appendMarkdown('</div>');

  return tooltip;
}

/**
 * Show an error state in the status bar
 */
export function showError(message: string): void {
  statusBarItem.text = '$(error) Enterprise Stats';
  statusBarItem.tooltip = new vscode.MarkdownString(`⚠️ **Error:** ${message}`);
  log(`[Status Bar] Error: ${message}`, true);
}

/**
 * Show a loading state in the status bar
 */
export function showLoading(): void {
  statusBarItem.text = '$(sync~spin) Loading...';
  statusBarItem.tooltip = 'Fetching usage data...';
}
