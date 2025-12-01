import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import * as vscode from 'vscode';

import { getUserDirPath } from '../utils/context.js';
import { log } from '../utils/logger.js';

// Constants
const LARGE_FILE_THRESHOLD_BYTES = 1.5 * 1024 * 1024 * 1024; // 1.5 GB
const CLI_MAX_BUFFER_BYTES = 10 * 1024 * 1024; // 10 MB

interface IJwtPayload {
  sub?: string;
  [key: string]: unknown;
}

/**
 * Simple JWT payload decoder (no verification needed)
 * JWT format: header.payload.signature (all base64url encoded)
 */
function decodeJwtPayload(token: string): IJwtPayload | undefined {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return undefined;
    }
    const payload = parts[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(decoded) as IJwtPayload;
  } catch {
    return undefined;
  }
}

/**
 * Get the default user directory path for Cursor
 */
function getDefaultUserDirPath(): string {
  const userDir = getUserDirPath();
  log(`[Database] Default user directory path: ${userDir}`);
  return userDir;
}

/**
 * Get the Windows username when running in WSL
 */
function getWindowsUsername(): string | undefined {
  try {
    const result = execSync('cmd.exe /C "echo %USERNAME%"', { encoding: 'utf8' });
    return result.trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Get the path to the Cursor database file
 */
export function getCursorDBPath(): string {
  const config = vscode.workspace.getConfiguration('cursorEnterpriseStats');
  const customPath = config.get<string>('customDatabasePath');

  if (customPath?.trim()) {
    log(`[Database] Using custom path: ${customPath}`);
    return customPath;
  }

  const userDirPath = getDefaultUserDirPath();
  const dbRelativePath = path.join('User', 'globalStorage', 'state.vscdb');

  if (process.platform === 'win32') {
    return path.join(userDirPath, dbRelativePath);
  }

  if (process.platform === 'linux' && vscode.env.remoteName === 'wsl') {
    const windowsUsername = getWindowsUsername();
    if (windowsUsername) {
      return path.join(
        '/mnt/c/Users',
        windowsUsername,
        'AppData/Roaming',
        vscode.env.appName,
        dbRelativePath,
      );
    }
  }

  return path.join(userDirPath, dbRelativePath);
}

/**
 * Query token from database using sqlite3 CLI
 * This handles large database files that exceed Node.js memory limits
 */
function queryTokenWithCLI(dbPath: string): string | undefined {
  try {
    log('[Database] Using sqlite3 CLI for large database file');

    const query = `SELECT value FROM ItemTable WHERE key = 'cursorAuth/accessToken';`;
    const result = execSync(`sqlite3 "${dbPath}" "${query}"`, {
      encoding: 'utf8',
      maxBuffer: CLI_MAX_BUFFER_BYTES,
    });

    const token = result.trim();
    if (!token) {
      log('[Database] No token found via CLI');
      return undefined;
    }

    log(`[Database] Token retrieved via CLI, starts with: ${token.substring(0, 20)}...`);
    return token;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log('[Database] CLI query failed: ' + message, true);
    return undefined;
  }
}

/**
 * Query token from database using sql.js (in-memory)
 */
async function queryTokenWithSqlJs(dbPath: string): Promise<string | undefined> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
  const initSqlJs = require('sql.js');
  const dbBuffer = fs.readFileSync(dbPath);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
  const SQL = await initSqlJs();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
  const db = new SQL.Database(new Uint8Array(dbBuffer));

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const result = db.exec(
      "SELECT value FROM ItemTable WHERE key = 'cursorAuth/accessToken'",
    ) as Array<{ values: Array<Array<string>> }>;

    if (!result.length || !result[0].values.length) {
      log('[Database] No token found in database');
      return undefined;
    }

    const token = result[0].values[0][0];
    log(`[Database] Token starts with: ${token.substring(0, 20)}...`);
    return token;
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    db.close();
  }
}

/**
 * Extract the raw token from the database (via CLI or sql.js)
 */
async function extractRawToken(dbPath: string, fileSize: number): Promise<string | undefined> {
  if (fileSize > LARGE_FILE_THRESHOLD_BYTES) {
    return queryTokenWithCLI(dbPath);
  }

  try {
    return await queryTokenWithSqlJs(dbPath);
  } catch (memError: unknown) {
    const message = memError instanceof Error ? memError.message : 'Unknown error';
    log('[Database] In-memory approach failed, falling back to CLI: ' + message, true);
    return queryTokenWithCLI(dbPath);
  }
}

/**
 * Process a raw JWT token into a session token
 */
function processJwtToken(token: string): string | undefined {
  const payload = decodeJwtPayload(token);

  if (!payload?.sub) {
    log('[Database] Invalid JWT structure', true);
    return undefined;
  }

  const subParts = payload.sub.toString().split('|');

  if (subParts.length < 2 || !subParts[1]) {
    log('[Database] Invalid sub format in JWT', true);
    return undefined;
  }

  const userId = subParts[1];
  const sessionToken = `${userId}%3A%3A${token}`;
  log(`[Database] Created session token, length: ${sessionToken.length}`);
  return sessionToken;
}

/**
 * Get the Cursor authentication token from the local database
 */
export async function getCursorTokenFromDB(): Promise<string | undefined> {
  try {
    const dbPath = getCursorDBPath();
    log(`[Database] Attempting to open database at: ${dbPath}`);

    if (!fs.existsSync(dbPath)) {
      log('[Database] Database file does not exist', true);
      return undefined;
    }

    const stats = fs.statSync(dbPath);
    const fileSizeGB = stats.size / (1024 * 1024 * 1024);
    log(`[Database] Database file size: ${fileSizeGB.toFixed(2)} GB`);

    const token = await extractRawToken(dbPath, stats.size);
    if (!token) {
      return undefined;
    }

    return processJwtToken(token);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    log('[Database] Error: ' + message, true);
    return undefined;
  }
}
