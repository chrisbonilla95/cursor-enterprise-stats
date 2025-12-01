import * as vscode from 'vscode';

import {
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

/**
 * Update the status bar with usage summary data
 */
export function updateStatusBar(data: IUsageSummaryResponse): void {
  const individualUsed = data.individualUsage.overall.used;
  const formattedUsage = formatCentsToDollars(individualUsed);

  // Set the status bar text
  statusBarItem.text = `$(pulse) ${formattedUsage}`;

  // Create the tooltip
  statusBarItem.tooltip = createTooltip(data);

  log(`[Status Bar] Updated: ${formattedUsage}`);
}

/**
 * Create a markdown tooltip with usage details
 */
function createTooltip(data: IUsageSummaryResponse): vscode.MarkdownString {
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
