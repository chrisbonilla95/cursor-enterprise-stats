import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | undefined;
let loggingEnabled = true; // Cached config value

/**
 * Initialize logging with output channel and config change listener
 */
export function initializeLogging(context: vscode.ExtensionContext): void {
  try {
    // Create output channel
    outputChannel = vscode.window.createOutputChannel('Cursor Enterprise Stats');
    context.subscriptions.push(outputChannel);

    // Read initial config value
    loggingEnabled = vscode.workspace
      .getConfiguration('cursorEnterpriseStats')
      .get<boolean>('enableLogging', true);

    // Listen for config changes
    const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('cursorEnterpriseStats.enableLogging')) {
        loggingEnabled = vscode.workspace
          .getConfiguration('cursorEnterpriseStats')
          .get<boolean>('enableLogging', true);
      }
    });
    context.subscriptions.push(configListener);

    log('[Initialization] Output channel created successfully');
  } catch {
    process.stderr.write('[Critical] Failed to create output channel\n');
  }
}

/**
 * Log a message to the output channel and console
 * @param message - The message to log
 * @param isError - Whether this is an error message (always logged regardless of settings)
 */
export function log(message: string, isError: boolean = false): void {
  // Skip logging if disabled (unless it's an error)
  if (!isError && !loggingEnabled) {
    return;
  }

  const timestamp = new Date().toISOString();
  const logLevel = isError ? 'ERROR' : 'INFO';
  const logMessage = `[${timestamp}] [${logLevel}] ${message}`;

  // Log to VS Code debug console (process.stdout/stderr for extension host)
  if (isError) {
    process.stderr.write(logMessage + '\n');
  } else {
    process.stdout.write(logMessage + '\n');
  }

  // Log to output channel if available
  try {
    outputChannel?.appendLine(logMessage);
  } catch {
    // Ignore output channel errors
  }
}
