import * as vscode from 'vscode';
import { ColorScheme, ExtensionConfig, GroupByMode } from './types';
import { logWarn } from './util/log';
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
 * 重點（`feat/R12` + 0.4.0 gate review R1）：
 * - **不可拋出**：這是啟動流程的一段，失敗只能記錄並繼續，否則 `activate()` 會中止、
 *   整個擴充不會註冊任何東西。
 * - 未宣告的鍵**無法**用 `inspect()` 取得各層級值（實測只回 `{ key }`），因此三個
 *   `ConfigurationTarget` 都嘗試清除，各自獨立 try/catch。
 * - 翻譯後的 `groupBy` 寫入 Global，與擴充自身選單 `setGroupBy()` 寫入的位置一致；
 *   舊旗標若原先是 workspace／folder 層，意圖會被提升為使用者層（已在 CHANGELOG 說明）。
 */
export async function migrateLegacyGroupBySettings(): Promise<'none' | 'migrated' | 'failed'> {
  try {
    const config = vscode.workspace.getConfiguration(SECTION);
    const legacyValue = config.get<unknown>(LEGACY_GROUP_BY_DIRECTORY_KEY);
    // 必須用 inspect() 取「使用者真的寫過的值」：`get('groupBy')` 會回 manifest 的預設值
    // （`none`），若拿它當「已設定」就會把「只有舊旗標為 true」的使用者誤判成 explicit，
    // 舊意圖因此被丟掉（實機驗證時踩到：groupBy 停在 none）。
    const inspected = config.inspect<unknown>('groupBy');
    const explicitGroupBy =
      inspected?.workspaceFolderValue ?? inspected?.workspaceValue ?? inspected?.globalValue;
    const decision = decideLegacyGroupByMigration(explicitGroupBy, legacyValue);
    if (!decision.removeLegacy && !decision.groupBy) {
      return 'none';
    }
    if (decision.groupBy) {
      await config.update('groupBy', decision.groupBy, vscode.ConfigurationTarget.Global);
    }
    if (decision.removeLegacy) {
      await removeLegacyGroupByKey(config);
    }
    return 'migrated';
  } catch (error) {
    logWarn('Could not migrate the legacy "groupByDirectory" setting; it was left untouched.', error);
    return 'failed';
  }
}

async function removeLegacyGroupByKey(config: vscode.WorkspaceConfiguration): Promise<void> {
  const targets = [
    vscode.ConfigurationTarget.Global,
    vscode.ConfigurationTarget.Workspace,
    vscode.ConfigurationTarget.WorkspaceFolder,
  ];
  for (const target of targets) {
    try {
      await config.update(LEGACY_GROUP_BY_DIRECTORY_KEY, undefined, target);
    } catch (error) {
      // 單一層失敗（唯讀、policy 控管、不支援 folder scope）不影響其他層與啟用流程
      logWarn(`Could not clear the legacy "groupByDirectory" setting at target ${target}.`, error);
    }
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
