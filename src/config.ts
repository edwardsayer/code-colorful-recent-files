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
  await removeLegacyGroupByKey(collectConfigScopes());
}

/**
 * 一次性清理舊設定 `groupByDirectory`（0.4.0 移除該宣告後，殘留值會被 VS Code
 * 標成「未知設定」）。舊版每次切換分組都會寫入此鍵，所以實際使用者很可能有。
 *
 * 重點（`feat/R12` ＋ 0.4.0 gate review R1／R1b）：
 * - **不可拋出**：這是啟動流程的一段，失敗只能記錄並繼續，否則 `activate()` 會中止、
 *   整個擴充不會註冊任何東西。
 * - **多根工作區的 folder 層要用 resource 讀寫**：不帶 resource 的 `getConfiguration()`
 *   看不到 folder 值（實測 `get('groupByDirectory')` 回 undefined），因此每個資料夾都要
 *   用 `getConfiguration(section, folder.uri)` 各讀一次，否則 folder 層的舊鍵永遠不會被發現。
 * - 未宣告的鍵沒有 `inspect()` 可用（實測只回 `{ key }`），所以只能逐層讀 `get()`。
 * - 翻譯後的 `groupBy` 寫入 Global，與擴充自身選單 `setGroupBy()` 一致；舊旗標若原先是
 *   workspace／folder 層，意圖會被提升為使用者層（CHANGELOG 已說明）。
 */
export async function migrateLegacyGroupBySettings(): Promise<'none' | 'migrated' | 'failed'> {
  try {
    const scopes = collectConfigScopes();
    const legacyValue = firstDefined(scopes.map((scope) => scope.config.get<unknown>(LEGACY_GROUP_BY_DIRECTORY_KEY)));
    const explicitGroupBy = firstDefined(
      scopes.map((scope) => {
        const inspected = scope.config.inspect<unknown>('groupBy');
        return inspected?.workspaceFolderValue ?? inspected?.workspaceValue ?? inspected?.globalValue;
      })
    );

    const decision = decideLegacyGroupByMigration(explicitGroupBy, legacyValue);
    if (!decision.removeLegacy && !decision.groupBy) {
      return 'none';
    }
    if (decision.groupBy) {
      await vscode.workspace
        .getConfiguration(SECTION)
        .update('groupBy', decision.groupBy, vscode.ConfigurationTarget.Global);
    }
    if (decision.removeLegacy) {
      await removeLegacyGroupByKey(scopes);
    }
    return 'migrated';
  } catch (error) {
    logWarn('Could not migrate the legacy "groupByDirectory" setting; it was left untouched.', error);
    return 'failed';
  }
}

interface ConfigScope {
  config: vscode.WorkspaceConfiguration;
  /** 多根工作區的資料夾（用於 folder 層讀寫）；未設定表示不帶 resource 的全域檢視 */
  folderUri?: vscode.Uri;
  folderName?: string;
}

/** 全域檢視 ＋ 每個工作區資料夾的 scoped 檢視（多根時 folder 層只有 scoped 檢視看得到） */
function collectConfigScopes(): ConfigScope[] {
  const scopes: ConfigScope[] = [{ config: vscode.workspace.getConfiguration(SECTION) }];
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    scopes.push({
      config: vscode.workspace.getConfiguration(SECTION, folder.uri),
      folderUri: folder.uri,
      folderName: folder.name,
    });
  }
  return scopes;
}

function firstDefined<T>(values: (T | undefined)[]): T | undefined {
  return values.find((value) => value !== undefined);
}

async function removeLegacyGroupByKey(scopes: ConfigScope[]): Promise<void> {
  const base = scopes[0].config;
  for (const target of [vscode.ConfigurationTarget.Global, vscode.ConfigurationTarget.Workspace]) {
    try {
      await base.update(LEGACY_GROUP_BY_DIRECTORY_KEY, undefined, target);
    } catch (error) {
      // 單一層失敗（唯讀、policy 控管）不影響其他層與啟用流程
      logWarn(`Could not clear the legacy "groupByDirectory" setting at target ${target}.`, error);
    }
  }
  // Folder 層要帶 resource：單一資料夾工作區就是 `.vscode/settings.json`（已由 Workspace 覆蓋），
  // 因此只在多根工作區逐資料夾處理，避免對不存在的 folder scope 寫入而產生無意義警告。
  const folderScopes = scopes.filter((scope) => scope.folderUri);
  if (folderScopes.length <= 1) {
    return;
  }
  for (const scope of folderScopes) {
    try {
      await scope.config.update(
        LEGACY_GROUP_BY_DIRECTORY_KEY,
        undefined,
        vscode.ConfigurationTarget.WorkspaceFolder
      );
    } catch (error) {
      logWarn(`Could not clear the legacy "groupByDirectory" setting for folder ${scope.folderName}.`, error);
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
