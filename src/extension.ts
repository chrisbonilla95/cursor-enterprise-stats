import * as vscode from 'vscode';

import {
  createStatusBarItem,
  showError,
  showLoading,
  updateStatusBar,
} from './handlers/statusBar.js';
import { fetchUsageSummary } from './services/api.js';
import { getCursorTokenFromDB } from './services/database.js';
import { initializeContext } from './utils/context.js';
import { initializeLogging, log } from './utils/logger.js';

let statusBarItem: vscode.StatusBarItem;
let refreshInterval: NodeJS.Timeout | undefined;
let isRefreshing = false;

// Default refresh interval: 60 seconds
const REFRESH_INTERVAL_MS = 60 * 1000;

/**
 * Refresh stats from the API
 * Uses a lock to prevent concurrent refresh calls
 */
async function refreshStats(): Promise<void> {
  // Prevent concurrent refreshes
  if (isRefreshing) {
    log('[Stats] Refresh already in progress, skipping...');
    return;
  }

  isRefreshing = true;
  log('[Stats] Refreshing usage data...');
  showLoading();

  try {
    const token = await getCursorTokenFromDB();

    if (!token) {
      showError('Not signed in to Cursor');
      return;
    }

    const usageData = await fetchUsageSummary(token);
    updateStatusBar(usageData);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch usage data';
    log('[Stats] Error refreshing stats: ' + message, true);
    showError(message);
  } finally {
    isRefreshing = false;
  }
}

/**
 * Start the auto-refresh interval
 */
function startRefreshInterval(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }

  refreshInterval = setInterval(() => {
    void refreshStats();
  }, REFRESH_INTERVAL_MS);

  log(`[Refresh] Started refresh interval: ${REFRESH_INTERVAL_MS}ms`);
}

/**
 * Stop the auto-refresh interval
 */
function stopRefreshInterval(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = undefined;
    log('[Refresh] Stopped refresh interval');
  }
}

export function activate(context: vscode.ExtensionContext): void {
  try {
    // Initialize context module (extracts userDirPath for database)
    initializeContext(context);

    // Initialize logging
    initializeLogging(context);
    log('[Initialization] Extension activation started');

    // Create status bar item
    statusBarItem = createStatusBarItem();
    statusBarItem.show();

    // Register refresh command
    const refreshCommand = vscode.commands.registerCommand(
      'cursor-enterprise-stats.refresh',
      async () => {
        log('[Command] Manual refresh triggered');
        await refreshStats();
      },
    );

    // Register settings command
    const settingsCommand = vscode.commands.registerCommand(
      'cursor-enterprise-stats.openSettings',
      async () => {
        await vscode.commands.executeCommand(
          'workbench.action.openSettings',
          '@ext:chrisbonilla95.cursor-enterprise-stats',
        );
      },
    );

    // Set status bar click command
    statusBarItem.command = 'cursor-enterprise-stats.refresh';

    // Add window focus listener for better UX
    const focusListener = vscode.window.onDidChangeWindowState((e) => {
      if (e.focused) {
        log('[Window] Window focused, refreshing stats...');
        void refreshStats();
        startRefreshInterval();
      } else {
        stopRefreshInterval();
      }
    });

    // Register subscriptions
    context.subscriptions.push(statusBarItem, refreshCommand, settingsCommand, focusListener);

    // Start refresh interval and do initial fetch
    startRefreshInterval();

    // Initial fetch with small delay
    setTimeout(() => {
      void refreshStats();
    }, 500);

    log('[Initialization] Extension activation completed');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log(`[Critical] Failed to activate extension: ${errorMessage}`, true);
    throw error;
  }
}

export function deactivate(): void {
  log('[Deactivation] Extension deactivation started');
  stopRefreshInterval();
  log('[Deactivation] Extension deactivation completed');
}
