import * as path from 'node:path';
import * as vscode from 'vscode';
import { getExtensionConfig } from './config';
import { RecentFilesManager } from './recentFilesManager';
import { RecentFileRecord, RecentFolderElement, RecentTreeElement } from './types';
import { createColorDotSvgDataUri, interpolateRainbow } from './util/color';
import { calculateHeatmapLevel, formatRelativeTime, getMetricTime } from './util/time';
import { HeatmapLevel } from './types';

export class RecentTreeDataProvider implements vscode.TreeDataProvider<RecentTreeElement> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<RecentTreeElement | undefined | null | void>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly manager: RecentFilesManager) {
    this.manager.onDidChangeRecentFiles(() => {
      this.refresh();
    });
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: RecentTreeElement): vscode.TreeItem {
    if (element.kind === 'folder') {
      const item = new vscode.TreeItem(element.folderName, vscode.TreeItemCollapsibleState.Expanded);
      item.iconPath = new vscode.ThemeIcon('folder');
      item.description = `${element.files.length}`;
      item.tooltip = element.folderPath;
      item.contextValue = 'folderItem';
      return item;
    }

    // element.kind === 'file'
    const uri = vscode.Uri.parse(element.record.uri);
    const item = new vscode.TreeItem(uri, vscode.TreeItemCollapsibleState.None);

    const config = getExtensionConfig();
    const metricTime = getMetricTime(element.record, config.highlightMode);
    const timeStr = formatRelativeTime(metricTime);

    // 計算相對工作區路徑
    let relPath = '';
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (workspaceFolder) {
      relPath = path.relative(workspaceFolder.uri.fsPath, path.dirname(uri.fsPath));
    } else {
      relPath = path.dirname(uri.fsPath);
    }

    // 圖示與色彩設定
    if (config.colorScheme === 'rankSpectrum') {
      const rankInfo = this.manager.getRecordRank(element.record.uri);
      if (rankInfo) {
        const { rank, total } = rankInfo;
        const t = total > 1 ? rank / (total - 1) : 0;
        // 運算漸變出來的精確彩虹 hex 色碼
        const colorHex = interpolateRainbow(t);
        const dataUriString = createColorDotSvgDataUri(colorHex);
        item.iconPath = vscode.Uri.parse(dataUriString);

        const rankTag = `#${rank + 1}`;
        if (config.groupByDirectory) {
          item.description = `${rankTag} • ${timeStr}`;
        } else {
          item.description = relPath ? `${rankTag} • ${relPath} • ${timeStr}` : `${rankTag} • ${timeStr}`;
        }
      } else {
        item.description = timeStr;
      }
    } else {
      // timeBucket 模式
      const level = calculateHeatmapLevel(metricTime);
      let dotColor: string | undefined;
      switch (level) {
        case HeatmapLevel.Fresh:
          dotColor = '#10b981'; // 翠綠
          break;
        case HeatmapLevel.Warm:
          dotColor = '#f59e0b'; // 金黃
          break;
        case HeatmapLevel.Day:
          dotColor = '#f97316'; // 亮橘
          break;
        case HeatmapLevel.Old:
        default:
          dotColor = '#94a3b8'; // 灰藍
          break;
      }
      item.iconPath = vscode.Uri.parse(createColorDotSvgDataUri(dotColor));

      if (config.groupByDirectory) {
        item.description = timeStr;
      } else {
        item.description = relPath ? `${relPath} • ${timeStr}` : timeStr;
      }
    }

    item.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [uri],
    };

    item.contextValue = 'fileItem';
    return item;
  }

  public getChildren(element?: RecentTreeElement): vscode.ProviderResult<RecentTreeElement[]> {
    const config = getExtensionConfig();
    const records = this.manager.getRecords();

    if (!element) {
      // 根層級
      if (!config.groupByDirectory) {
        // 扁平模式：直接回傳所有檔案
        return records.map((record) => ({
          kind: 'file',
          record,
        }));
      }

      // 目錄分組模式：依上層目錄分組
      const groups = new Map<string, RecentFileRecord[]>();
      for (const record of records) {
        const uri = vscode.Uri.parse(record.uri);
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        let folderKey = '';
        if (workspaceFolder) {
          folderKey = path.relative(workspaceFolder.uri.fsPath, path.dirname(uri.fsPath)) || '.';
        } else {
          folderKey = path.dirname(uri.fsPath);
        }

        const list = groups.get(folderKey) ?? [];
        list.push(record);
        groups.set(folderKey, list);
      }

      const folderElements: RecentFolderElement[] = [];
      for (const [folderPath, files] of groups.entries()) {
        folderElements.push({
          kind: 'folder',
          folderPath,
          folderName: folderPath === '.' ? '工作區根目錄' : folderPath,
          files,
        });
      }

      return folderElements;
    }

    // 子層級：Folder 下的檔案
    if (element.kind === 'folder') {
      return element.files.map((record) => ({
        kind: 'file',
        record,
        parentFolder: element.folderPath,
      }));
    }

    return [];
  }
}
