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
    // 各 scope 的**有效值**（已含繼承）：只要有任何一個 scope 看到 true，就代表使用者要目錄分組。
    // 用 `firstDefined()` 挑第一個會踩到「Global false ＋ folder true」→ 選到 false、
    // 不寫 groupBy 卻仍清掉所有舊鍵，把較具體 scope 的意圖刪掉（round 3 review R3-2）。
    const legacyValues = scopes.map((scope) => scope.config.get<unknown>(LEGACY_GROUP_BY_DIRECTORY_KEY));
    const legacyValue = legacyValues.includes(true) ? true : firstDefined(legacyValues);
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
      const writeResult = await withTimeout(
        vscode.workspace
          .getConfiguration(SECTION)
          .update('groupBy', decision.groupBy, vscode.ConfigurationTarget.Global),
        'groupBy'
      );
      if (writeResult === 'timeout') {
        // **不可繼續清除舊鍵**：`groupBy` 沒寫成功就把舊旗標刪掉，等於直接丟掉使用者的分組意圖。
        // 寧可留下舊鍵（VS Code 會標成未知設定）也不能讓設定變成「兩邊都沒有」。
        logWarn('Writing "groupBy" did not complete; the legacy setting was left in place.');
        return 'failed';
      }
    }
    if (decision.removeLegacy) {
      const cleared = await removeLegacyGroupByKey(scopes);
      // 一個都沒清掉（例如使用者設定被 policy 鎖成唯讀）→ 誠實回報失敗，不要記成已遷移
      if (!cleared) {
        return 'failed';
      }
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

/**
 * 設定寫入的等待上限。
 *
 * 為什麼需要：使用者設定若被 policy 鎖成唯讀，`config.update()` 會先顯示 VS Code 自己的
 * 錯誤對話框並**等待使用者關閉**，Promise 可能長期不 settle（實測 55 秒仍未回來）。
 * 遷移是背景清理，不能因此永遠沒有結論，所以用 timeout 收斂：超過就記錄「未完成」並停手，
 * 對話框本身仍由使用者的 VS Code 處理（我們無法關閉它）。
 */
const SETTINGS_WRITE_TIMEOUT_MS = 5000;

async function withTimeout<T>(promise: Thenable<T>, label: string): Promise<T | 'timeout'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), SETTINGS_WRITE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
    void label;
  }
}

async function removeLegacyGroupByKey(scopes: ConfigScope[]): Promise<boolean> {
  const base = scopes[0].config;
  let cleared = false;
  for (const target of [vscode.ConfigurationTarget.Global, vscode.ConfigurationTarget.Workspace]) {
    try {
      const result = await withTimeout(base.update(LEGACY_GROUP_BY_DIRECTORY_KEY, undefined, target), `clear@${target}`);
      if (result === 'timeout') {
        logWarn(`Clearing the legacy "groupByDirectory" setting at target ${target} did not complete (settings may be locked by policy).`);
        return cleared;
      }
      cleared = true;
    } catch (error) {
      // 唯讀設定時 VS Code 會先自己跳錯誤對話框並等待（實測每次約 12 秒），
      // 因此第一次失敗就停止後續層級，避免重複等待與重複對話框。
      logWarn(`Could not clear the legacy "groupByDirectory" setting at target ${target}.`, error);
      return cleared;
    }
  }
  // Folder 層要帶 resource：單一資料夾工作區就是 `.vscode/settings.json`（已由 Workspace 覆蓋），
  // 因此只在多根工作區逐資料夾處理，避免對不存在的 folder scope 寫入而產生無意義警告。
  const folderScopes = scopes.filter((scope) => scope.folderUri);
  if (folderScopes.length <= 1) {
    return cleared;
  }
  for (const scope of folderScopes) {
    try {
      const result = await withTimeout(
        scope.config.update(LEGACY_GROUP_BY_DIRECTORY_KEY, undefined, vscode.ConfigurationTarget.WorkspaceFolder),
        `clear-folder@${scope.folderName}`
      );
      if (result === 'timeout') {
        logWarn(`Clearing the legacy "groupByDirectory" setting for folder ${scope.folderName} did not complete.`);
        return cleared;
      }
      cleared = true;
    } catch (error) {
      logWarn(`Could not clear the legacy "groupByDirectory" setting for folder ${scope.folderName}.`, error);
      return cleared;
    }
  }
  return cleared;
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
