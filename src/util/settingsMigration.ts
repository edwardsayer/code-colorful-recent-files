import { GroupByMode } from '../types';

/**
 * 舊設定 `codeColorfulRecentFiles.groupByDirectory` 的遷移決策（純邏輯）。
 *
 * 背景（`feat.legacy-flag`，BACKLOG B-08）：這個布林旗標自第一個 commit 就存在，
 * 後來被 `groupBy`（`none`／`directory`／`type`）取代但一直保留相容讀寫。
 * 使用者於 2026-10-31 裁決在 0.4.0 **直接移除**。
 *
 * 移除後該鍵會變成 VS Code 眼中的未知設定（使用者 settings.json 出現警告），
 * 而舊版每次切換分組都會把它寫進全域設定，所以必須做一次性清理。
 * 清理前要先**保留使用者的意圖**：只有在 `groupBy` 從未設定、且舊旗標為 true 時，
 * 才把它翻譯成 `groupBy: 'directory'`。
 */
export interface LegacyGroupByMigration {
  /** 需要寫入的 `groupBy` 值；undefined 表示不必動 */
  groupBy?: GroupByMode;
  /** 是否應把舊鍵從設定中移除 */
  removeLegacy: boolean;
}

/** `groupBy` 的合法值（與 manifest 的 enum 一致） */
export function isGroupByMode(value: unknown): value is GroupByMode {
  return value === 'none' || value === 'directory' || value === 'type';
}

/**
 * @param rawGroupBy  目前 `groupBy` 的原始值（可能未設定／非法值）
 * @param legacyValue 舊旗標的原始值（`undefined` 表示使用者沒有這個鍵）
 */
export function decideLegacyGroupByMigration(
  rawGroupBy: unknown,
  legacyValue: unknown
): LegacyGroupByMigration {
  if (legacyValue === undefined) {
    return { removeLegacy: false };
  }
  if (isGroupByMode(rawGroupBy)) {
    // 新鍵已有效，舊鍵只是殘留 → 直接移除，不改使用者選擇
    return { removeLegacy: true };
  }
  // 新鍵未設定（或值不合法）：把舊旗標翻譯過來，再移除舊鍵
  if (legacyValue === true) {
    return { groupBy: 'directory', removeLegacy: true };
  }
  return { removeLegacy: true };
}
