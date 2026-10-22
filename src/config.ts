import * as vscode from 'vscode';
import { ColorScheme, ExtensionConfig } from './types';

const SECTION = 'codeColorfulRecentFiles';

export function getExtensionConfig(): ExtensionConfig {
  const config = vscode.workspace.getConfiguration(SECTION);
  return {
    groupByDirectory: config.get<boolean>('groupByDirectory', false),
    maxRecentFiles: config.get<number>('maxRecentFiles', 50),
    highlightMode: config.get<'lastAccess' | 'lastModified'>('highlightMode', 'lastAccess'),
    colorScheme: config.get<ColorScheme>('colorScheme', 'rankSpectrum'),
    showColorDotIcon: config.get<boolean>('showColorDotIcon', false),
    styleNativeExplorer: config.get<boolean>('styleNativeExplorer', false),
  };
}

export async function setGroupByDirectory(value: boolean): Promise<void> {
  const config = vscode.workspace.getConfiguration(SECTION);
  await config.update('groupByDirectory', value, vscode.ConfigurationTarget.Global);
}

export async function setColorScheme(value: ColorScheme): Promise<void> {
  const config = vscode.workspace.getConfiguration(SECTION);
  await config.update('colorScheme', value, vscode.ConfigurationTarget.Global);
}
