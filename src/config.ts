import * as vscode from 'vscode';
import { ExtensionConfig } from './types';

const SECTION = 'codeColorfulRecentFiles';

export function getExtensionConfig(): ExtensionConfig {
  const config = vscode.workspace.getConfiguration(SECTION);
  return {
    groupByDirectory: config.get<boolean>('groupByDirectory', false),
    maxRecentFiles: config.get<number>('maxRecentFiles', 50),
    highlightMode: config.get<'lastAccess' | 'lastModified'>('highlightMode', 'lastAccess'),
  };
}

export async function setGroupByDirectory(value: boolean): Promise<void> {
  const config = vscode.workspace.getConfiguration(SECTION);
  await config.update('groupByDirectory', value, vscode.ConfigurationTarget.Global);
}
