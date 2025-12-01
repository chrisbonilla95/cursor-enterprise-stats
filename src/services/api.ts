import axios, { isAxiosError } from 'axios';

import { log } from '../utils/logger.js';

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
