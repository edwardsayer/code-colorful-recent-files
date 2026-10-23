import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { getExtensionConfig } from './config';
import { RecentFileRecord } from './types';
import { logError, logInfo } from './util/log';
import { normalizePathKey } from './util/pathUtil';

const STORAGE_KEY = 'codeColorfulRecentFiles.records';
const BACKUP_FILE_NAME = 'colorful-recent-files.json';

export { normalizePathKey };

export class RecentFilesManager {
  private recordsMap = new Map<string, RecentFileRecord>();
  private sortedCache: RecentFileRecord[] | null = null;
  /** 記憶體中追蹤當前所有開啟的 tabs 本機路徑 key */
  private openTabsSet = new Set<string>();
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

  /** 取得資料夾手動排序順序清單 */
  public getFolderManualOrder(): string[] {
    return this.context.workspaceState.get<string[]>('codeColorfulRecentFiles.folderManualOrder') || [];
  }

  /** 保存資料夾手動排序順序清單 */
  public async setFolderManualOrder(order: string[]): Promise<void> {
    await this.context.workspaceState.update('codeColorfulRecentFiles.folderManualOrder', order);
    this._onDidChangeRecentFiles.fire();
  }

  /** 關閉對應路徑的 VS Code Open Tab */
  public async closeTabForFile(fsPath: string): Promise<void> {
    const targetKey = normalizePathKey(fsPath);
    const tabsToClose: vscode.Tab[] = [];
    try {
      for (const group of vscode.window.tabGroups.all) {
        for (const tab of group.tabs) {
          const uri = this.extractTabUri(tab);
          if (uri && normalizePathKey(uri.fsPath) === targetKey) {
            tabsToClose.push(tab);
          }
        }
      }
      if (tabsToClose.length > 0) {
        await vscode.window.tabGroups.close(tabsToClose);
      }
    } catch (err) {
      logError('Failed to close tab for file: ' + fsPath, err);
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
  public async touchFile(fsPath: string, fireEvent = true): Promise<void> {
    const key = normalizePathKey(fsPath);
    const now = Date.now();
    let record = this.recordsMap.get(key);

    if (record) {
      record.lastOpenedTime = now;
    } else {
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
    if (!tab || !tab.input) return undefined;
    const input = tab.input as any;
    if (input.uri instanceof vscode.Uri) {
      return input.uri;
    }
    if (input.resource instanceof vscode.Uri) {
      return input.resource;
    }
    return undefined;
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
