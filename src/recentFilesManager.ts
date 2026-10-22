import * as vscode from 'vscode';
import { getExtensionConfig } from './config';
import { RecentFileRecord } from './types';
import { logInfo } from './util/log';

const STORAGE_KEY = 'codeColorfulRecentFiles.records';

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

  private loadFromStorage(): void {
    const raw = this.context.workspaceState.get<RecentFileRecord[]>(STORAGE_KEY, []);
    this.recordsMap.clear();
    for (const item of raw) {
      if (item && item.uri) {
        this.recordsMap.set(item.uri, item);
      }
    }
    this.sortedCache = null;
  }

  private async saveToStorage(): Promise<void> {
    const records = this.getRecords();
    await this.context.workspaceState.update(STORAGE_KEY, records);
  }

  public getRecords(): RecentFileRecord[] {
    if (this.sortedCache) {
      return this.sortedCache;
    }
    const config = getExtensionConfig();
    const sorted = Array.from(this.recordsMap.values()).sort((a, b) => {
      const timeA = Math.max(a.lastOpenedTime, a.lastModifiedTime);
      const timeB = Math.max(b.lastOpenedTime, b.lastModifiedTime);
      return timeB - timeA;
    });
    this.sortedCache = sorted.slice(0, config.maxRecentFiles);
    return this.sortedCache;
  }

  public getRecordByUri(uriString: string): RecentFileRecord | undefined {
    return this.recordsMap.get(uriString);
  }

  /** 取得該 URI 在最新到最舊列表中的順位與總數 (0-indexed) */
  public getRecordRank(uriString: string): { rank: number; total: number } | undefined {
    const records = this.getRecords();
    const index = records.findIndex((r) => r.uri === uriString);
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

    const uriStr = uri.toString();
    const now = Date.now();
    let record = this.recordsMap.get(uriStr);

    if (!record) {
      record = {
        uri: uriStr,
        fsPath: uri.fsPath,
        lastOpenedTime: now,
        lastModifiedTime: kind === 'modify' ? now : 0,
      };
      this.recordsMap.set(uriStr, record);
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
        this.recordsMap.set(r.uri, r);
      }
      this.sortedCache = records;
    }

    await this.saveToStorage();
    this._onDidChangeRecentFiles.fire();
  }

  public async removeRecord(uriStr: string): Promise<void> {
    if (this.recordsMap.delete(uriStr)) {
      this.sortedCache = null;
      await this.saveToStorage();
      this._onDidChangeRecentFiles.fire();
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
    for (const [uriStr, record] of Array.from(this.recordsMap.entries())) {
      try {
        await vscode.workspace.fs.stat(vscode.Uri.parse(record.uri));
      } catch {
        this.recordsMap.delete(uriStr);
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
