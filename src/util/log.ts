import * as vscode from 'vscode';

let channel: vscode.LogOutputChannel | undefined;

export function initLogger(context: vscode.ExtensionContext): vscode.LogOutputChannel {
  channel = vscode.window.createOutputChannel('Colorful Recent Files', { log: true });
  context.subscriptions.push(channel);
  return channel;
}

export function logInfo(message: string, ...args: unknown[]): void {
  channel?.info(message, ...args);
}

export function logWarn(message: string, ...args: unknown[]): void {
  channel?.warn(message, ...args);
}

export function logError(message: string, error?: unknown): void {
  if (error instanceof Error) {
    channel?.error(message, error.stack ?? error.message);
  } else if (error) {
    channel?.error(message, String(error));
  } else {
    channel?.error(message);
  }
}
