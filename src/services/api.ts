import axios, { isAxiosError } from 'axios';

import { log } from '../utils/logger.js';

// Response type for /api/dashboard/get-me
export interface IGetMeResponse {
  authId: string;
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  workosId: string;
  teamId: number;
  createdAt: string;
  isEnterpriseUser: boolean;
}

// Leaderboard entry for tab completions
export interface ITabLeaderboardEntry {
  email: string;
  user_id: number;
  total_tab_accepts: number;
  total_tab_lines_accepted: number;
  total_tab_lines_suggested: number;
  tab_line_acceptance_ratio: number;
  tab_accept_ratio: number;
  favorite_model: string;
  rank: number;
  profile_picture_url: string | null;
}

// Leaderboard entry for composer/agent
export interface IComposerLeaderboardEntry {
  email: string;
  user_id: number;
  total_diff_accepts: number;
  total_composer_lines_accepted: number;
  total_composer_lines_suggested: number;
  composer_line_acceptance_ratio: number;
  favorite_model: string;
  rank: number;
  profile_picture_url: string | null;
}

// Full leaderboard response
// Note: Leaderboard sections may be omitted by API when user has 0 activity
export interface ILeaderboardResponse {
  tab_leaderboard?: {
    data: ITabLeaderboardEntry[];
    total_users: number;
  };
  composer_leaderboard?: {
    data: IComposerLeaderboardEntry[];
    total_users: number;
  };
}

// Leaderboard sort options
export type LeaderboardSortBy = 'composer_lines' | 'composer_accepts' | 'tab_accepts';

// Combined leaderboard data with all rankings
export interface ILeaderboardData {
  // Agent Lines of Code (primary)
  agentLines: {
    userEntry: IComposerLeaderboardEntry | null;
    totalUsers: number;
  };
  // Accepted Diffs
  acceptedDiffs: {
    userEntry: IComposerLeaderboardEntry | null;
    totalUsers: number;
  };
  // Tab Completions
  tabCompletions: {
    userEntry: ITabLeaderboardEntry | null;
    totalUsers: number;
  };
}

// Response type for the usage-summary API
export interface IUsageSummaryResponse {
  billingCycleStart: string;
  billingCycleEnd: string;
  membershipType: string;
  limitType: string;
  isUnlimited: boolean;
  individualUsage: {
    overall: {
      enabled: boolean;
      used: number; // in cents
      limit: number | null;
      remaining: number | null;
    };
  };
  teamUsage: {
    onDemand: {
      enabled: boolean;
      used: number;
      limit: number;
      remaining: number;
    };
    pooled: {
      enabled: boolean;
      used: number; // in cents
      limit: number; // in cents
      remaining: number; // in cents
    };
  };
}

// Browser-like headers to bypass CORS validation
const getBrowserHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  Cookie: `WorkosCursorSessionToken=${token}`,
  Origin: 'https://cursor.com',
  Referer: 'https://cursor.com/settings',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: '*/*',
  'Accept-Language': 'en',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
});

/**
 * Fetch usage summary from the Cursor API
 * This is the single source of truth for all usage data
 */
export async function fetchUsageSummary(token: string): Promise<IUsageSummaryResponse> {
  try {
    log('[API] Fetching usage summary...');

    const response = await axios.get<IUsageSummaryResponse>(
      'https://cursor.com/api/usage-summary',
      {
        headers: getBrowserHeaders(token),
      },
    );

    log('[API] Usage summary fetched successfully');

    return response.data;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log('[API] Error fetching usage summary: ' + message, true);

    // Log additional details for Axios errors
    if (isAxiosError(error) && error.response) {
      log(
        `[API] Error details: status=${error.response.status}, data=${JSON.stringify(error.response.data)}`,
        true,
      );
    }
    throw error;
  }
}

/**
 * Format cents to dollar string with commas (e.g., 31471 -\> "$314.71", 100000000 -\> "$1,000,000.00")
 */
export function formatCentsToDollars(cents: number): string {
  const dollars = cents / 100;
  return (
    '$' +
    dollars.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/**
 * Calculate the percentage of pooled usage contributed by individual usage
 */
export function calculateIndividualContribution(
  individualUsed: number,
  pooledUsed: number,
): number {
  if (pooledUsed === 0) {
    return 0;
  }
  return (individualUsed / pooledUsed) * 100;
}

/**
 * Format a Date to YYYY-MM-DD string for API calls
 */
function formatDateForAPI(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get date range for leaderboard
 */
function getLeaderboardDateRange(days: number): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return {
    startDate: formatDateForAPI(startDate),
    endDate: formatDateForAPI(endDate),
  };
}

/**
 * Fetch current user info from the Cursor API
 */
export async function fetchUserInfo(token: string): Promise<IGetMeResponse> {
  try {
    log('[API] Fetching user info...');

    const response = await axios.get<IGetMeResponse>('https://cursor.com/api/dashboard/get-me', {
      headers: getBrowserHeaders(token),
    });

    log(`[API] User info fetched: ${response.data.email}, teamId: ${response.data.teamId}`);

    return response.data;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log('[API] Error fetching user info: ' + message, true);

    if (isAxiosError(error) && error.response) {
      log(
        `[API] Error details: status=${error.response.status}, data=${JSON.stringify(error.response.data)}`,
        true,
      );
    }
    throw error;
  }
}

/**
 * Fetch leaderboard data from the Cursor API
 */
async function fetchLeaderboardWithSort(
  token: string,
  teamId: number,
  userEmail: string,
  sortBy: LeaderboardSortBy,
  days: number,
): Promise<ILeaderboardResponse> {
  try {
    log(`[API] Fetching leaderboard (sortBy: ${sortBy}, days: ${days})...`);

    const { startDate, endDate } = getLeaderboardDateRange(days);
    const params = new URLSearchParams({
      startDate,
      endDate,
      pageSize: '10',
      teamId: teamId.toString(),
      user: userEmail,
      leaderboardSortBy: sortBy,
    });

    const response = await axios.get<ILeaderboardResponse>(
      `https://cursor.com/api/v2/analytics/team/leaderboard?${params.toString()}`,
      {
        headers: getBrowserHeaders(token),
      },
    );

    const totalUsers =
      response.data.composer_leaderboard?.total_users ??
      response.data.tab_leaderboard?.total_users ??
      0;
    log(`[API] Leaderboard fetched (${sortBy}): ${totalUsers} users`);

    return response.data;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log(`[API] Error fetching leaderboard (${sortBy}): ` + message, true);

    if (isAxiosError(error) && error.response) {
      log(
        `[API] Error details: status=${error.response.status}, data=${JSON.stringify(error.response.data)}`,
        true,
      );
    }
    throw error;
  }
}

/**
 * Find user entry in composer leaderboard by email
 * Returns null if leaderboard section is missing (happens when user has 0 activity)
 */
function findComposerEntry(
  data: ILeaderboardResponse,
  email: string,
): IComposerLeaderboardEntry | null {
  return data.composer_leaderboard?.data?.find((entry) => entry.email === email) ?? null;
}

/**
 * Find user entry in tab leaderboard by email
 * Returns null if leaderboard section is missing (happens when user has 0 activity)
 */
function findTabEntry(data: ILeaderboardResponse, email: string): ITabLeaderboardEntry | null {
  return data.tab_leaderboard?.data?.find((entry) => entry.email === email) ?? null;
}

/**
 * Fetch all leaderboard data with different sort options to get accurate rankings
 */
export async function fetchAllLeaderboards(
  token: string,
  teamId: number,
  userEmail: string,
  days: number = 30,
): Promise<ILeaderboardData> {
  log(`[API] Fetching all leaderboards (${days} days)...`);

  // Fetch all three leaderboards in parallel
  const [agentLinesData, acceptedDiffsData, tabCompletionsData] = await Promise.all([
    fetchLeaderboardWithSort(token, teamId, userEmail, 'composer_lines', days),
    fetchLeaderboardWithSort(token, teamId, userEmail, 'composer_accepts', days),
    fetchLeaderboardWithSort(token, teamId, userEmail, 'tab_accepts', days),
  ]);

  return {
    agentLines: {
      userEntry: findComposerEntry(agentLinesData, userEmail),
      totalUsers: agentLinesData.composer_leaderboard?.total_users ?? 0,
    },
    acceptedDiffs: {
      userEntry: findComposerEntry(acceptedDiffsData, userEmail),
      totalUsers: acceptedDiffsData.composer_leaderboard?.total_users ?? 0,
    },
    tabCompletions: {
      userEntry: findTabEntry(tabCompletionsData, userEmail),
      totalUsers: tabCompletionsData.tab_leaderboard?.total_users ?? 0,
    },
  };
}
