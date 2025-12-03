import * as vscode from 'vscode';

import {
  createStatusBarItem,
  showError,
  showLoading,
  updateStatusBar,
} from './handlers/statusBar.js';
import {
  type IGetMeResponse,
  type ILeaderboardData,
  type IUsageSummaryResponse,
  fetchAllLeaderboards,
  fetchUsageSummary,
  fetchUserInfo,
} from './services/api.js';
import { getCursorTokenFromDB } from './services/database.js';
import { initializeContext } from './utils/context.js';
import { initializeLogging, log } from './utils/logger.js';

let statusBarItem: vscode.StatusBarItem;
let refreshInterval: NodeJS.Timeout | undefined;
let isRefreshing = false;

// Cached data for re-rendering without API calls
let cachedUserInfo: IGetMeResponse | null = null;
let cachedUsageData: IUsageSummaryResponse | null = null;
let cachedLeaderboardData: ILeaderboardData | null = null;

// Refresh intervals
const REFRESH_INTERVAL_MS = 60 * 1000; // Normal: 60 seconds
const FAST_RETRY_INTERVAL_MS = 1000; // Fast retry: 1 second
const FAST_RETRY_DURATION_MS = 60 * 1000; // Fast retry for 60 seconds max

// Fast retry state for "not signed in" errors
let fastRetryStartTime: number | null = null;

/**
 * Start fast retry mode for "not signed in" errors
 * Retries every second for up to 60 seconds, then reverts to normal interval
 */
function startFastRetry(): void {
  const now = Date.now();

  // Check if we've been in fast retry mode too long
  if (fastRetryStartTime && now - fastRetryStartTime >= FAST_RETRY_DURATION_MS) {
    log('[Refresh] Fast retry duration exceeded, reverting to normal interval');
    fastRetryStartTime = null;
    startRefreshInterval();
    return;
  }

  // Start fast retry if not already started
  if (!fastRetryStartTime) {
    fastRetryStartTime = now;
    log('[Refresh] Starting fast retry mode (1s intervals for 60s)');
  }

  // Clear existing interval and set fast retry
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }

  refreshInterval = setInterval(() => {
    void refreshStats();
  }, FAST_RETRY_INTERVAL_MS);
}

/**
 * Stop fast retry mode and revert to normal interval
 */
function stopFastRetry(): void {
  if (fastRetryStartTime) {
    log('[Refresh] Stopping fast retry mode, reverting to normal interval');
    fastRetryStartTime = null;
    startRefreshInterval();
  }
}

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
      startFastRetry();
      return;
    }

    // Token found - stop fast retry if active
    stopFastRetry();

    // Get user info (from cache or fetch)
    if (!cachedUserInfo) {
      log('[Stats] Fetching user info (not cached)...');
      cachedUserInfo = await fetchUserInfo(token);
    }

    // Check leaderboard settings
    const config = vscode.workspace.getConfiguration('cursorEnterpriseStats');
    const leaderboardEnabled = config.get<boolean>('enableLeaderboard') ?? true;
    const leaderboardDays = config.get<number>('leaderboardDateRange') ?? 30;

    // Fetch usage summary and leaderboard data in parallel
    const [usageData, leaderboardData] = await Promise.all([
      fetchUsageSummary(token),
      leaderboardEnabled && cachedUserInfo.isEnterpriseUser && cachedUserInfo.teamId
        ? fetchAllLeaderboards(token, cachedUserInfo.teamId, cachedUserInfo.email, leaderboardDays)
        : Promise.resolve(null),
    ]);

    // Cache the data for re-rendering on settings change
    cachedUsageData = usageData;
    cachedLeaderboardData = leaderboardData;

    updateStatusBar(usageData, leaderboardData, cachedUserInfo);
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

    // Add configuration change listener to update status bar immediately
    const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('cursorEnterpriseStats.statusBarRankDisplay')) {
        log('[Config] Rank display setting changed, updating status bar...');
        // Re-render status bar with cached data (no API call needed)
        if (cachedUsageData) {
          updateStatusBar(cachedUsageData, cachedLeaderboardData, cachedUserInfo);
        }
      }
      if (e.affectsConfiguration('cursorEnterpriseStats.enableLeaderboard')) {
        log('[Config] Leaderboard setting changed, refreshing...');
        // Clear cached leaderboard data and refresh
        cachedLeaderboardData = null;
        void refreshStats();
      }
      if (e.affectsConfiguration('cursorEnterpriseStats.leaderboardDateRange')) {
        log('[Config] Leaderboard date range changed, refreshing...');
        // Clear cached leaderboard data and refresh with new date range
        cachedLeaderboardData = null;
        void refreshStats();
      }
    });

    // Register subscriptions
    context.subscriptions.push(
      statusBarItem,
      refreshCommand,
      settingsCommand,
      focusListener,
      configListener,
    );

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
