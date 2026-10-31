import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { getExtensionConfig } from './config';
import { RecentFileRecord } from './types';
import { addToPinnedOrder, isPinned, removeFromPinnedOrder } from './util/groupSort';
import { removePinnedDirKeys, removeRecordPaths, rewritePinnedDirKeys, rewriteRecordPaths, isPathWithin } from './util/fileOps';
import { isOpaqueTabInput, readTabInputPath } from './util/tabInput';

/**
 * 重建以 `normalizePathKey` 為 key 的路徑集合（`openTabsSet` 用）。
 *
 * 不能直接拿 PathRecord 硬轉：這組 key 已經過 `normalizePathKey`（小寫 + 正規化），
 * 與原始 `fsPath` 大小寫可能不同。這裡對 key 做同樣的前綴改寫，並重新正規化結果，
 * 使其與 `isOpenTab()` 的查表方式一致。
 */
function rekeyPathSet(keys: ReadonlySet<string>, from: string, to: string): Set<string> {
  const next = new Set<string>();
  for (const key of keys) {
    if (isPathWithin(from, key)) {
      const record = rewriteRecordPaths([{ uri: '', fsPath: key, lastOpenedTime: 0, lastModifiedTime: 0 }], from, to)[0];
      next.add(normalizePathKey(record.fsPath));
    } else {
      next.add(key);
    }
  }
  return next;
}
import { logError, logInfo, logWarn } from './util/log';
import { normalizePathKey } from './util/pathUtil';

const STORAGE_KEY = 'codeColorfulRecentFiles.records';
const PINNED_ORDER_KEY = 'codeColorfulRecentFiles.pinnedGroupOrder';
const BACKUP_FILE_NAME = 'colorful-recent-files.json';

export { normalizePathKey };

export class RecentFilesManager {
  private recordsMap = new Map<string, RecentFileRecord>();
  private sortedCache: RecentFileRecord[] | null = null;
  /** 記憶體中追蹤當前所有開啟的 tabs 本機路徑 key */
  private openTabsSet = new Set<string>();
  /** 空 `Tab.input` 的診斷訊息只記一次（每個 session） */
  private opaqueTabInputWarned = false;
  private readonly _onDidChangeRecentFiles = new vscode.EventEmitter<void>();
  public readonly onDidChangeRecentFiles = this._onDidChangeRecentFiles.event;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.loadFromStorage();
    this.registerEventListeners();
    this.scanInitialTabs();
  }

  /** 取得工作區本機備份路徑 (跨 install / uninstall 保留資料) */
  private getWorkspaceBackupPath(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return undefined;
    }
    const rootPath = folders[0].uri.fsPath;
    const vscodeDir = path.join(rootPath, '.vscode');
    return path.join(vscodeDir, BACKUP_FILE_NAME);
  }

  private resolveValidTime(fsPath: string, existingTime?: number): number {
    if (typeof existingTime === 'number' && !isNaN(existingTime) && existingTime > 0) {
      return existingTime;
    }
    try {
      if (fs.existsSync(fsPath)) {
        const stat = fs.statSync(fsPath);
        return stat.mtimeMs || Date.now();
      }
    } catch {
      // 忽略錯誤
    }
    return Date.now();
  }

  private loadFromStorage(): void {
    let raw = this.context.workspaceState.get<RecentFileRecord[]>(STORAGE_KEY);

    // 若 workspaceState 為空 (例如剛被 uninstall 再 reinstall)，嘗試從工作區備份恢復
    if (!raw || raw.length === 0) {
      const backupPath = this.getWorkspaceBackupPath();
      if (backupPath && fs.existsSync(backupPath)) {
        try {
          const content = fs.readFileSync(backupPath, 'utf8');
          raw = JSON.parse(content) as RecentFileRecord[];
          logInfo(`Restored ${raw.length} recent files from backup file: ${backupPath}`);
        } catch (err) {
          logError('Failed to read backup recent files file', err);
        }
      }
    }

    this.recordsMap.clear();
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (item && item.fsPath) {
          if (fs.existsSync(item.fsPath)) {
            const lastOpened = this.resolveValidTime(item.fsPath, item.lastOpenedTime);
            const lastModified = this.resolveValidTime(item.fsPath, item.lastModifiedTime);
            const record: RecentFileRecord = {
              uri: item.uri || vscode.Uri.file(item.fsPath).toString(),
              fsPath: item.fsPath,
              lastOpenedTime: lastOpened,
              lastModifiedTime: lastModified,
            };
            this.recordsMap.set(normalizePathKey(item.fsPath), record);
          }
        }
      }
    }
    this.sortedCache = null;
  }

  private async saveToStorage(): Promise<void> {
    const records = this.getRecords();
    await this.context.workspaceState.update(STORAGE_KEY, records);

    // 跨 install 備份至 .vscode/colorful-recent-files.json
    try {
      const backupPath = this.getWorkspaceBackupPath();
      if (backupPath) {
        const dir = path.dirname(backupPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(backupPath, JSON.stringify(records, null, 2), 'utf8');
      }
    } catch (err) {
      logError('Failed to save recent files backup', err);
    }
  }

  /**
   * 作廢排序快取。
   *
   * `getRecords()` 的 `sortedCache` 會依 `maxRecentFiles` 截斷；資料事件都會自行清快取，
   * 但**設定變更**（如調整上限）不涉及資料變動，必須由外部明確呼叫此方法，
   * 否則畫面會一直沿用舊上限，直到 reload 或下一次資料事件才更新。
   */
  public invalidateCache(): void {
    this.sortedCache = null;
  }

  public getRecords(): RecentFileRecord[] {
    if (this.sortedCache) {
      return this.sortedCache;
    }
    const config = getExtensionConfig();
    const sorted = Array.from(this.recordsMap.values()).sort((a, b) => {
      const timeA = Math.max(a.lastOpenedTime || 0, a.lastModifiedTime || 0);
      const timeB = Math.max(b.lastOpenedTime || 0, b.lastModifiedTime || 0);
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      return a.fsPath.localeCompare(b.fsPath);
    });
    this.sortedCache = sorted.slice(0, config.maxRecentFiles);
    return this.sortedCache;
  }

  public getRecordByFsPath(fsPath: string): RecentFileRecord | undefined {
    return this.recordsMap.get(normalizePathKey(fsPath));
  }

  public getRecordByUri(uriString: string): RecentFileRecord | undefined {
    try {
      const parsed = vscode.Uri.parse(uriString);
      return this.getRecordByFsPath(parsed.fsPath);
    } catch {
      return undefined;
    }
  }

  /** 取得視圖中可見的檔案紀錄 (支援 Sync with Open Tabs 過濾，但持久化歷史完整保留) */
  public getVisibleRecords(): RecentFileRecord[] {
    const all = this.getRecords();
    const config = getExtensionConfig();
    if (config.syncWithOpenTabs) {
      return all.filter((r) => this.openTabsSet.has(normalizePathKey(r.fsPath)));
    }
    return all;
  }

  /** 檢查特定路徑是否在當前開啟的 tabs 之中 */
  public isOpenTab(fsPath: string): boolean {
    return this.openTabsSet.has(normalizePathKey(fsPath));
  }

  /** 取得已 Pin 分組 key 清單（順序即手動排列順序） */
  public getPinnedGroupOrder(): string[] {
    return this.context.workspaceState.get<string[]>(PINNED_ORDER_KEY) || [];
  }

  /** 保存已 Pin 分組 key 清單 */
  public async setPinnedGroupOrder(order: string[], fireEvent = true): Promise<void> {
    await this.context.workspaceState.update(PINNED_ORDER_KEY, order);
    if (fireEvent) {
      this._onDidChangeRecentFiles.fire();
    }
  }

  /** 切換分組的 Pin 狀態；回傳切換後是否為已 Pin */
  public async togglePinnedGroup(folderKey: string): Promise<boolean> {
    const current = this.getPinnedGroupOrder();
    const next = isPinned(current, folderKey)
      ? removeFromPinnedOrder(current, folderKey)
      : addToPinnedOrder(current, folderKey);
    await this.setPinnedGroupOrder(next);
    return next.includes(folderKey);
  }

  /** 清空已 Pin 分組（清除全部歷史時一併還原預設狀態） */
  public async clearPinnedGroups(): Promise<void> {
    if (this.getPinnedGroupOrder().length > 0) {
      await this.setPinnedGroupOrder([], false);
    }
  }

  /**
   * `rename`／`move` 後同步所有保存了該路徑的位置。
   *
   * 三處必須一起改，否則會出現「檔案已改名但歷史清單還在舊路徑」：
   * 1. `recordsMap`（`workspaceState` 的 records）
   * 2. `openTabsSet`（避免 rename 後舊 key 永遠殘留，使 `isOpenTab` 回錯）
   * 3. `pinnedGroupOrder` 的 `dir:<path>` key（Type 分組不受影響）
   *
   * 時間戳由 `rewriteRecordPaths` 保留——移動不應讓檔案在清單中變新或變舊。
   */
  public async applyPathRewrite(from: string, to: string): Promise<void> {
    const rewritten = rewriteRecordPaths(this.getRecords(), from, to);
    this.recordsMap.clear();
    for (const record of rewritten) {
      this.recordsMap.set(normalizePathKey(record.fsPath), record);
    }
    this.sortedCache = null;

    this.openTabsSet = rekeyPathSet(this.openTabsSet, from, to);

    const pinned = this.getPinnedGroupOrder();
    const nextPinned = rewritePinnedDirKeys(pinned, from, to);
    if (nextPinned.length !== pinned.length || nextPinned.some((key, index) => key !== pinned[index])) {
      await this.context.workspaceState.update(PINNED_ORDER_KEY, nextPinned);
    }

    await this.saveToStorage();
    this._onDidChangeRecentFiles.fire();
  }

  /**
   * `delete` 後從歷史移除該路徑**及其所有子項**（刪除目錄時的情境），
   * 並同步清理 `pinnedGroupOrder` 的 `dir:<path>` key（`type:` key 不受影響）。
   */
  public async applyPathRemoval(target: string): Promise<void> {
    const kept = removeRecordPaths(this.getRecords(), target);
    this.recordsMap.clear();
    for (const record of kept) {
      this.recordsMap.set(normalizePathKey(record.fsPath), record);
    }
    this.sortedCache = null;

    for (const key of Array.from(this.openTabsSet)) {
      if (isPathWithin(target, key)) {
        this.openTabsSet.delete(key);
      }
    }

    const pinned = this.getPinnedGroupOrder();
    const nextPinned = removePinnedDirKeys(pinned, target);
    if (nextPinned.length !== pinned.length) {
      await this.context.workspaceState.update(PINNED_ORDER_KEY, nextPinned);
    }

    await this.saveToStorage();
    this._onDidChangeRecentFiles.fire();
  }

  /** 關閉對應路徑的 VS Code Open Tab */
  /** 取得開啟指定檔案的所有分頁 */
  public getTabsForFiles(fsPaths: string[]): vscode.Tab[] {
    const targetKeys = new Set(fsPaths.map((p) => normalizePathKey(p)));
    const tabs: vscode.Tab[] = [];
    try {
      for (const group of vscode.window.tabGroups.all) {
        for (const tab of group.tabs) {
          const uri = this.extractTabUri(tab);
          if (uri && targetKeys.has(normalizePathKey(uri.fsPath))) {
            tabs.push(tab);
          }
        }
      }
    } catch (err) {
      logError('Failed to enumerate tabs for files', err);
    }
    return tabs;
  }

  public async closeTabForFile(fsPath: string): Promise<void> {
    await this.closeTabsForFiles([fsPath]);
  }

  public async closeTabsForFiles(fsPaths: string[]): Promise<void> {
    const tabsToClose = this.getTabsForFiles(fsPaths);
    try {
      if (tabsToClose.length > 0) {
        await vscode.window.tabGroups.close(tabsToClose);
      }
    } catch (err) {
      logError('Failed to close tabs for files', err);
    }
  }

  /** 取得該檔案在可見清單中的順位與總數 (0-indexed) */
  public getRecordRank(fsPath: string): { rank: number; total: number } | undefined {
    const records = this.getVisibleRecords();
    const targetKey = normalizePathKey(fsPath);
    const index = records.findIndex((r) => normalizePathKey(r.fsPath) === targetKey);
    if (index === -1) {
      return undefined;
    }
    return { rank: index, total: records.length };
  }

  /** 主動置頂特定檔案 (點擊即時刷新) */
  /**
   * 新增紀錄前的存在性檢查。
   *
   * 只擋「**建立新紀錄**」，不擋既有紀錄的時間更新（既有紀錄可能因暫時性 I/O 失敗而 stat 不到，
   * 不應因此丟失）。
   *
   * 為何需要：檔案被 rename／move／delete 之後，指向舊路徑的編輯器（尤其是 **dirty buffer**，
   * VS Code 無法安全搬移未儲存的內容）仍會觸發 `onDidChangeActiveTextEditor`，
   * 把已經不存在的舊路徑重新記回歷史，造成「改名後舊名仍在清單裡」的幽靈條目（feat/R6 實機重現）。
   * 對不存在的檔案建立紀錄沒有意義——該列點下去也開不起來。
   */
  private canCreateRecord(fsPath: string): boolean {
    try {
      return fs.existsSync(fsPath);
    } catch {
      return false;
    }
  }

  public async touchFile(fsPath: string, fireEvent = true): Promise<void> {
    const key = normalizePathKey(fsPath);
    const now = Date.now();
    let record = this.recordsMap.get(key);

    if (record) {
      record.lastOpenedTime = now;
    } else {
      if (!this.canCreateRecord(fsPath)) {
        return;
      }
      const realMtime = this.resolveValidTime(fsPath);
      record = {
        uri: vscode.Uri.file(fsPath).toString(),
        fsPath: fsPath,
        lastOpenedTime: now,
        lastModifiedTime: realMtime,
      };
      this.recordsMap.set(key, record);
    }

    this.sortedCache = null;
    await this.saveToStorage();
    if (fireEvent) {
      this._onDidChangeRecentFiles.fire();
    }
  }

  public async recordAccess(uri: vscode.Uri, kind: 'open' | 'modify'): Promise<void> {
    if (uri.scheme !== 'file') {
      return;
    }

    const key = normalizePathKey(uri.fsPath);
    const now = Date.now();
    let record = this.recordsMap.get(key);

    if (!record) {
      if (!this.canCreateRecord(uri.fsPath)) {
        return;
      }
      const realMtime = this.resolveValidTime(uri.fsPath);
      record = {
        uri: uri.toString(),
        fsPath: uri.fsPath,
        lastOpenedTime: now,
        lastModifiedTime: kind === 'modify' ? now : realMtime,
      };
      this.recordsMap.set(key, record);
    } else {
      if (kind === 'open') {
        record.lastOpenedTime = now;
      } else {
        record.lastModifiedTime = now;
      }
    }

    this.sortedCache = null;

    // 限制最大筆數
    const config = getExtensionConfig();
    if (this.recordsMap.size > config.maxRecentFiles * 1.5) {
      const records = this.getRecords();
      this.recordsMap.clear();
      for (const r of records) {
        this.recordsMap.set(normalizePathKey(r.fsPath), r);
      }
      this.sortedCache = records;
    }

    await this.saveToStorage();
    this._onDidChangeRecentFiles.fire();
  }

  public async removeRecord(uriStr: string): Promise<void> {
    try {
      const parsed = vscode.Uri.parse(uriStr);
      const key = normalizePathKey(parsed.fsPath);
      if (this.recordsMap.delete(key)) {
        this.sortedCache = null;
        await this.saveToStorage();
        this._onDidChangeRecentFiles.fire();
      }
    } catch {
      // 忽略錯誤
    }
  }

  public async clearAll(): Promise<void> {
    this.recordsMap.clear();
    this.sortedCache = null;
    await this.saveToStorage();
    await this.clearPinnedGroups();
    this._onDidChangeRecentFiles.fire();
    logInfo('Cleared all recent files history.');
  }

  public async pruneMissingFiles(): Promise<void> {
    let changed = false;
    for (const [key, record] of Array.from(this.recordsMap.entries())) {
      if (!fs.existsSync(record.fsPath)) {
        this.recordsMap.delete(key);
        changed = true;
      }
    }
    if (changed) {
      this.sortedCache = null;
      await this.saveToStorage();
      this._onDidChangeRecentFiles.fire();
    }
  }

  /** 從 Tab 物件中提取檔案 URI (支援圖片、二進位與文字自訂編輯器) */
  private extractTabUri(tab: vscode.Tab): vscode.Uri | undefined {
    if (!tab) return undefined;
    const input = tab.input as unknown;
    const location = readTabInputPath(input);
    if (!location) {
      this.warnOpaqueTabInput(tab, input);
      return undefined;
    }
    const raw = (input as { uri?: unknown }).uri ?? (input as { resource?: unknown }).resource;
    if (raw instanceof vscode.Uri) {
      return raw;
    }
    // 跨 Extension Host 邊界不保證是 `vscode.Uri`，用解析出的位置重建（只為 file scheme 負責）
    return vscode.Uri.file(location.fsPath);
  }

  /**
   * VS Code 1.144.0 實測：custom editor（圖片等）分頁的 `Tab.input` 在 Extension Host 端是
   * **`undefined`**（連物件都沒有）；同樣的程式在 VSCodium 1.140.0 收到 `{ uri, viewType }`。
   * 這種情況下本產品無法得知被開啟的檔案，只能不追蹤——但要留下**一次**警告，
   * 否則使用者只會覺得「剛開過的圖片不見了」，排查時日誌完全沒有線索。
   */
  private warnOpaqueTabInput(tab: vscode.Tab, input: unknown): void {
    if (this.opaqueTabInputWarned) return;
    if (!isOpaqueTabInput(input)) return;
    this.opaqueTabInputWarned = true;
    logWarn(
      `Tab input carries no uri (tab: "${tab.label}"): this VS Code build does not expose custom-editor inputs to extensions, so image/binary tabs are not tracked.`
    );
  }

  /** 檢查特定檔案是否仍於任一分頁群組中開啟 */
  private isFileStillOpenInAnyGroup(fsPath: string): boolean {
    const targetKey = normalizePathKey(fsPath);
    for (const group of vscode.window.tabGroups.all) {
      for (const tab of group.tabs) {
        const uri = this.extractTabUri(tab);
        if (uri && normalizePathKey(uri.fsPath) === targetKey) {
          return true;
        }
      }
    }
    return false;
  }

  private scanInitialTabs(): void {
    try {
      this.openTabsSet.clear();
      for (const group of vscode.window.tabGroups.all) {
        for (const tab of group.tabs) {
          const uri = this.extractTabUri(tab);
          if (uri && uri.scheme === 'file') {
            this.openTabsSet.add(normalizePathKey(uri.fsPath));
            this.touchFile(uri.fsPath, false);
          }
        }
      }
    } catch {
      // 忽略
    }
  }

  private registerEventListeners(): void {
    // 1. 活躍編輯器切換 (文字編輯器)
    this.context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor?.document && editor.document.uri.scheme === 'file') {
          this.openTabsSet.add(normalizePathKey(editor.document.uri.fsPath));
          this.recordAccess(editor.document.uri, 'open');
        }
      })
    );

    // 2. Tab 分頁事件監聽 (★ 支援圖像檔、CustomEditor 與任何二進位編輯器，以及開啟/關閉雙向同步)
    this.context.subscriptions.push(
      vscode.window.tabGroups.onDidChangeTabs((e) => {
        let changed = false;
        for (const tab of e.opened) {
          const uri = this.extractTabUri(tab);
          if (uri && uri.scheme === 'file') {
            const key = normalizePathKey(uri.fsPath);
            if (!this.openTabsSet.has(key)) {
              this.openTabsSet.add(key);
              changed = true;
            }
            this.recordAccess(uri, 'open');
          }
        }
        for (const tab of e.closed) {
          const uri = this.extractTabUri(tab);
          if (uri && uri.scheme === 'file') {
            if (!this.isFileStillOpenInAnyGroup(uri.fsPath)) {
              this.openTabsSet.delete(normalizePathKey(uri.fsPath));
              changed = true;
            }
          }
        }
        if (changed) {
          this._onDidChangeRecentFiles.fire();
        }
      })
    );

    this.context.subscriptions.push(
      vscode.window.tabGroups.onDidChangeTabGroups(() => {
        const activeTab = vscode.window.tabGroups.activeTabGroup?.activeTab;
        if (activeTab) {
          const uri = this.extractTabUri(activeTab);
          if (uri && uri.scheme === 'file') {
            this.openTabsSet.add(normalizePathKey(uri.fsPath));
            this.recordAccess(uri, 'open');
          }
        }
      })
    );

    // 3. 文件開啟
    this.context.subscriptions.push(
      vscode.workspace.onDidOpenTextDocument((doc) => {
        if (doc.uri.scheme === 'file') {
          this.openTabsSet.add(normalizePathKey(doc.uri.fsPath));
          this.recordAccess(doc.uri, 'open');
        }
      })
    );

    // 4. 文件編輯內容異動
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.contentChanges.length > 0) {
          this.recordAccess(e.document.uri, 'modify');
        }
      })
    );

    // 5. 文件儲存
    this.context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        this.recordAccess(doc.uri, 'modify');
      })
    );
  }
}
