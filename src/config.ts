import * as vscode from 'vscode';
import { ColorScheme, ExtensionConfig, GroupByMode } from './types';
import { decideLegacyGroupByMigration, isGroupByMode } from './util/settingsMigration';

const SECTION = 'codeColorfulRecentFiles';
/** 0.4.0 起不再宣告的舊設定鍵（`feat.legacy-flag`／B-08） */
const LEGACY_GROUP_BY_DIRECTORY_KEY = 'groupByDirectory';

export function getExtensionConfig(): ExtensionConfig {
  const config = vscode.workspace.getConfiguration(SECTION);
  const rawGroupBy = config.get<string>('groupBy');
  const groupBy: GroupByMode = isGroupByMode(rawGroupBy) ? rawGroupBy : 'none';

  return {
    groupBy,
    maxRecentFiles: config.get<number>('maxRecentFiles', 50),
    highlightMode: config.get<'lastAccess' | 'lastModified'>('highlightMode', 'lastAccess'),
    colorScheme: config.get<ColorScheme>('colorScheme', 'rankSpectrum'),
    showColorDotIcon: config.get<boolean>('showColorDotIcon', false),
    styleNativeExplorer: config.get<boolean>('styleNativeExplorer', false),
    syncWithOpenTabs: config.get<boolean>('syncWithOpenTabs', false),
  };
}

export async function setGroupBy(value: GroupByMode): Promise<void> {
  const config = vscode.workspace.getConfiguration(SECTION);
  await config.update('groupBy', value, vscode.ConfigurationTarget.Global);
  await removeLegacyGroupByKey(config);
}

/**
 * 一次性清理舊設定 `groupByDirectory`（0.4.0 移除該宣告後，殘留值會被 VS Code
 * 標成「未知設定」）。舊版每次切換分組都會寫入此鍵，所以實際使用者很可能有。
 *
 * 先依 `decideLegacyGroupByMigration()` 保留意圖（只有 `groupBy` 從未設定、
 * 舊旗標為 true 時才翻譯成 `directory`），再從 Global 與 Workspace 兩層移除。
 * 對已宣告移除的鍵，`inspect()` 可能不提供資訊，因此改用 `get()` 讀原始值。
 */
export async function migrateLegacyGroupBySettings(): Promise<boolean> {
  const config = vscode.workspace.getConfiguration(SECTION);
  const legacyValue = config.get<unknown>(LEGACY_GROUP_BY_DIRECTORY_KEY);
  // 必須用 inspect() 取「使用者真的寫過的值」：`get('groupBy')` 會回 manifest 的預設值
  // （`none`），若拿它當「已設定」就會把「只有舊旗標為 true」的使用者誤判成 explicit，
  // 舊意圖因此被丟掉（實機驗證時踩到：groupBy 停在 none）。
  const inspected = config.inspect<unknown>('groupBy');
  const explicitGroupBy =
    inspected?.globalValue ?? inspected?.workspaceValue ?? inspected?.workspaceFolderValue;
  const decision = decideLegacyGroupByMigration(explicitGroupBy, legacyValue);
  if (decision.groupBy) {
    await config.update('groupBy', decision.groupBy, vscode.ConfigurationTarget.Global);
  }
  if (!decision.removeLegacy) {
    return false;
  }
  await removeLegacyGroupByKey(config);
  return true;
}

async function removeLegacyGroupByKey(config: vscode.WorkspaceConfiguration): Promise<void> {
  try {
    await config.update(LEGACY_GROUP_BY_DIRECTORY_KEY, undefined, vscode.ConfigurationTarget.Global);
    await config.update(LEGACY_GROUP_BY_DIRECTORY_KEY, undefined, vscode.ConfigurationTarget.Workspace);
  } catch {
    // 唯讀設定（例如管理原則控管）時忽略：不讓清理失敗擋住啟用
  }
}

export async function setColorScheme(value: ColorScheme): Promise<void> {
  const config = vscode.workspace.getConfiguration(SECTION);
  await config.update('colorScheme', value, vscode.ConfigurationTarget.Global);
}

export async function setShowColorDotIcon(value: boolean): Promise<void> {
  const config = vscode.workspace.getConfiguration(SECTION);
  await config.update('showColorDotIcon', value, vscode.ConfigurationTarget.Global);
}

export async function setStyleNativeExplorer(value: boolean): Promise<void> {
  const config = vscode.workspace.getConfiguration(SECTION);
  await config.update('styleNativeExplorer', value, vscode.ConfigurationTarget.Global);
}

export async function setHighlightMode(value: 'lastAccess' | 'lastModified'): Promise<void> {
  const config = vscode.workspace.getConfiguration(SECTION);
  await config.update('highlightMode', value, vscode.ConfigurationTarget.Global);
}

export async function setSyncWithOpenTabs(value: boolean): Promise<void> {
  const config = vscode.workspace.getConfiguration(SECTION);
  await config.update('syncWithOpenTabs', value, vscode.ConfigurationTarget.Global);
}
