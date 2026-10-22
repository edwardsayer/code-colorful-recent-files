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
  private readonly _onDidChangeRecentFiles = new vscode.EventEmitter<void>();
  public readonly onDidChangeRecentFiles = this._onDidChangeRecentFiles.event;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.loadFromStorage();
    this.registerEventListeners();
    // 檢查現有活躍編輯器
    if (vscode.window.activeTextEditor) {
      this.recordAccess(vscode.window.activeTextEditor.document.uri, 'open');
    }
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
          // 檢查檔案是否存在；若存在，保證時間有效 (若時間遺失則補以真實 mtime)
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

  /** 取得該檔案在最新到最舊列表中的順位與總數 (0-indexed) */
  public getRecordRank(fsPath: string): { rank: number; total: number } | undefined {
    const records = this.getRecords();
    const targetKey = normalizePathKey(fsPath);
    const index = records.findIndex((r) => normalizePathKey(r.fsPath) === targetKey);
    if (index === -1) {
      return undefined;
    }
    return { rank: index, total: records.length };
  }

  public async recordAccess(uri: vscode.Uri, kind: 'open' | 'modify'): Promise<void> {
    // 僅追蹤 file 協定，排除虛擬文檔與內部 output
    if (uri.scheme !== 'file') {
      return;
    }

    const key = normalizePathKey(uri.fsPath);
    const now = Date.now();
    let record = this.recordsMap.get(key);

    if (!record) {
      // 全新加入時，若為 open，lastModified 以真實 mtime 保底，避免為 0
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

  private registerEventListeners(): void {
    // 活躍編輯器切換
    this.context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor?.document) {
          this.recordAccess(editor.document.uri, 'open');
        }
      })
    );

    // 文件開啟
    this.context.subscriptions.push(
      vscode.workspace.onDidOpenTextDocument((doc) => {
        this.recordAccess(doc.uri, 'open');
      })
    );

    // 文件編輯內容異動
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.contentChanges.length > 0) {
          this.recordAccess(e.document.uri, 'modify');
        }
      })
    );

    // 文件儲存
    this.context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        this.recordAccess(doc.uri, 'modify');
      })
    );
  }
}
