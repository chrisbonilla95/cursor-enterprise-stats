import * as path from 'path';

import * as vscode from 'vscode';

/**
 * Cached user directory path (computed once during activation)
 * This avoids needing to pass the extension context around
 */
let userDirPath: string | undefined;

/**
 * Initialize the context module with the extension context
 * Extracts and caches only what we need (userDirPath)
 */
export function initializeContext(context: vscode.ExtensionContext): void {
  const globalStoragePath = context.globalStorageUri.fsPath;
  // Go up 3 levels: globalStorage -> User -> [app directory]
  userDirPath = path.dirname(path.dirname(path.dirname(globalStoragePath)));
}

/**
 * Get the user directory path for database location
 * @throws Error if context has not been initialized
 */
export function getUserDirPath(): string {
  if (!userDirPath) {
    throw new Error('Context not initialized. Call initializeContext() first.');
  }
  return userDirPath;
}
