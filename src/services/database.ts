import * as path from 'path';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { log } from '../utils/logger';
import { getUserDirPath } from '../utils/context';
import { execSync } from 'child_process';

// Constants
const LARGE_FILE_THRESHOLD_BYTES = 1.5 * 1024 * 1024 * 1024; // 1.5 GB
const CLI_MAX_BUFFER_BYTES = 10 * 1024 * 1024; // 10 MB

interface JwtPayload {
    sub?: string;
    [key: string]: unknown;
}

/**
 * Simple JWT payload decoder (no verification needed)
 * JWT format: header.payload.signature (all base64url encoded)
 */
function decodeJwtPayload(token: string): JwtPayload | undefined {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return undefined;
        }
        // Decode the payload (second part)
        const payload = parts[1];
        // Convert base64url to base64
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        // Decode and parse JSON
        const decoded = Buffer.from(base64, 'base64').toString('utf8');
        return JSON.parse(decoded);
    } catch {
        return undefined;
    }
}

// Use globalStorageUri to get the user directory path
// Support Portable mode: https://code.visualstudio.com/docs/editor/portable
function getDefaultUserDirPath(): string {
    const userDir = getUserDirPath();
    log(`[Database] Default user directory path: ${userDir}`);
    return userDir;
}

export function getCursorDBPath(): string {
    const config = vscode.workspace.getConfiguration('cursorEnterpriseStats');
    const customPath = config.get<string>('customDatabasePath');

    if (customPath && customPath.trim() !== '') {
        log(`[Database] Using custom path: ${customPath}`);
        return customPath;
    }

    const userDirPath = getDefaultUserDirPath();

    if (process.platform === 'win32') {
        return path.join(userDirPath, 'User', 'globalStorage', 'state.vscdb');
    } else if (process.platform === 'linux') {
        const isWSL = vscode.env.remoteName === 'wsl';
        if (isWSL) {
            const windowsUsername = getWindowsUsername();
            if (windowsUsername) {
                const folderName = vscode.env.appName;
                return path.join(
                    '/mnt/c/Users',
                    windowsUsername,
                    'AppData/Roaming',
                    folderName,
                    'User/globalStorage/state.vscdb'
                );
            }
        }
        return path.join(userDirPath, 'User', 'globalStorage', 'state.vscdb');
    }
    
    return path.join(userDirPath, 'User', 'globalStorage', 'state.vscdb');
}

/**
 * Query token from database using sqlite3 CLI
 * This handles large database files that exceed Node.js memory limits
 */
function queryTokenWithCLI(dbPath: string): string | undefined {
    try {
        log('[Database] Using sqlite3 CLI for large database file');
        
        // Use sqlite3 CLI to query the token directly (no memory limit issues)
        const query = `SELECT value FROM ItemTable WHERE key = 'cursorAuth/accessToken';`;
        const result = execSync(`sqlite3 "${dbPath}" "${query}"`, {
            encoding: 'utf8',
            maxBuffer: CLI_MAX_BUFFER_BYTES
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

export async function getCursorTokenFromDB(): Promise<string | undefined> {
    try {
        const dbPath = getCursorDBPath();
        log(`[Database] Attempting to open database at: ${dbPath}`);

        if (!fs.existsSync(dbPath)) {
            log('[Database] Database file does not exist', true);
            return undefined;
        }

        // Check file size - use CLI for large files (> 1.5GB)
        const stats = fs.statSync(dbPath);
        const fileSizeGB = stats.size / (1024 * 1024 * 1024);
        log(`[Database] Database file size: ${fileSizeGB.toFixed(2)} GB`);

        let token: string | undefined;

        if (stats.size > LARGE_FILE_THRESHOLD_BYTES) {
            // File is larger than threshold, use CLI to avoid memory issues
            token = queryTokenWithCLI(dbPath);
        } else {
            // File is small enough to load into memory
            try {
                const initSqlJs = require('sql.js');
                const dbBuffer = fs.readFileSync(dbPath);
                const SQL = await initSqlJs();
                const db = new SQL.Database(new Uint8Array(dbBuffer));

                const result = db.exec("SELECT value FROM ItemTable WHERE key = 'cursorAuth/accessToken'");

                if (!result.length || !result[0].values.length) {
                    log('[Database] No token found in database');
                    db.close();
                    return undefined;
                }

                token = result[0].values[0][0] as string;
                log(`[Database] Token starts with: ${token.substring(0, 20)}...`);
                db.close();
            } catch (memError: unknown) {
                // Fallback to CLI if in-memory approach fails
                const message = memError instanceof Error ? memError.message : 'Unknown error';
                log('[Database] In-memory approach failed, falling back to CLI: ' + message, true);
                token = queryTokenWithCLI(dbPath);
            }
        }

        if (!token) {
            return undefined;
        }

        // Process the JWT token
        try {
            const payload = decodeJwtPayload(token);

            if (!payload || !payload.sub) {
                log('[Database] Invalid JWT structure', true);
                return undefined;
            }

            const sub = payload.sub.toString();
            const subParts = sub.split('|');
            
            if (subParts.length < 2 || !subParts[1]) {
                log('[Database] Invalid sub format in JWT', true);
                return undefined;
            }

            const userId = subParts[1];
            const sessionToken = `${userId}%3A%3A${token}`;
            log(`[Database] Created session token, length: ${sessionToken.length}`);
            return sessionToken;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            log('[Database] Error processing token: ' + message, true);
            return undefined;
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        log('[Database] Error: ' + message, true);
        return undefined;
    }
}

function getWindowsUsername(): string | undefined {
    try {
        const result = execSync('cmd.exe /C "echo %USERNAME%"', { encoding: 'utf8' });
        return result.trim() || undefined;
    } catch {
        return undefined;
    }
}
