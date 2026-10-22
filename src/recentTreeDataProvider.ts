import * as path from 'node:path';
import * as vscode from 'vscode';
import { getExtensionConfig } from './config';
import { RecentFilesManager } from './recentFilesManager';
import {
  HeatmapLevel,
  RECENT_FOLDER_SCHEME,
  RECENT_SCHEME,
  RecentFileRecord,
  RecentFolderElement,
  RecentTreeElement,
} from './types';
import { createColorDotSvgDataUri, interpolateRainbow } from './util/color';
import { calculateHeatmapLevel, getMetricTime } from './util/time';

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
      // 資料夾使用專屬 scheme 且攜帶檔案數量，使數量呈現在最右側標注 (Badge)
      const folderUri = vscode.Uri.file(element.folderAbsolutePath);
      const viewFolderUri = folderUri.with({
        scheme: RECENT_FOLDER_SCHEME,
        query: String(element.files.length),
      });

      const item = new vscode.TreeItem(viewFolderUri, vscode.TreeItemCollapsibleState.Expanded);
      // 標題只顯示最後一段
      item.label = element.folderName;
      // 檔案數量移至右邊 Badge 標注，清空 description
      item.description = undefined;
      // Hint (Tooltip) 顯示完整絕對路徑，與原生 Explorer 一致
      item.tooltip = element.folderAbsolutePath;
      item.contextValue = 'folderItem';

      return item;
    }

    // element.kind === 'file'
    const originalFileUri = vscode.Uri.file(element.record.fsPath);
    // 使用專屬 scheme，以利 FileDecoration 僅局部裝飾自家 TreeView，不污染原生 Explorer
    const viewItemUri = originalFileUri.with({ scheme: RECENT_SCHEME });

    const item = new vscode.TreeItem(viewItemUri, vscode.TreeItemCollapsibleState.None);
    const config = getExtensionConfig();

    // 檔案清空小字描述，資訊完整整合至右側標注 (Badge)
    item.description = undefined;
    // tooltip 維持原生路徑顯示，不額外附加自訂訊息
    item.tooltip = undefined;

    // 只有在使用者明確勾選 showColorDotIcon 時，才顯示色彩小圓點，預設維持原生檔案圖示主題
    if (config.showColorDotIcon) {
      if (config.colorScheme === 'rankSpectrum') {
        const rankInfo = this.manager.getRecordRank(element.record.fsPath);
        if (rankInfo) {
          const { rank, total } = rankInfo;
          const t = total > 1 ? rank / (total - 1) : 0;
          const colorHex = interpolateRainbow(t);
          item.iconPath = vscode.Uri.parse(createColorDotSvgDataUri(colorHex));
        }
      } else {
        const metricTime = getMetricTime(element.record, config.highlightMode);
        const level = calculateHeatmapLevel(metricTime);
        let dotColor = '#94a3b8';
        switch (level) {
          case HeatmapLevel.Fresh:
            dotColor = '#10b981';
            break;
          case HeatmapLevel.Warm:
            dotColor = '#f59e0b';
            break;
          case HeatmapLevel.Day:
            dotColor = '#f97316';
            break;
        }
        item.iconPath = vscode.Uri.parse(createColorDotSvgDataUri(dotColor));
      }
    } else {
      // 預設不覆寫 iconPath，交由 VS Code 根據 resourceUri 自動套用原生檔案主題圖示
      item.iconPath = undefined;
    }

    // 點擊事件：開啟真正的本機檔案
    item.command = {
      command: 'vscode.open',
      title: 'Open File',
      arguments: [originalFileUri],
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
      const groups = new Map<string, { folderAbsolutePath: string; files: RecentFileRecord[] }>();
      for (const record of records) {
        const fileDir = path.dirname(record.fsPath);
        const folderKey = fileDir.toLowerCase();

        const group = groups.get(folderKey);
        if (group) {
          group.files.push(record);
        } else {
          groups.set(folderKey, {
            folderAbsolutePath: fileDir,
            files: [record],
          });
        }
      }

      const folderElements: RecentFolderElement[] = [];
      const workspaceFolders = vscode.workspace.workspaceFolders;
      const workspaceRoot = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : undefined;

      for (const group of groups.values()) {
        const absDir = group.folderAbsolutePath;
        let shortName = path.basename(absDir);

        if (workspaceRoot && path.normalize(absDir).toLowerCase() === path.normalize(workspaceRoot).toLowerCase()) {
          shortName = '工作區根目錄';
        }

        folderElements.push({
          kind: 'folder',
          folderPath: workspaceRoot ? path.relative(workspaceRoot, absDir) || '.' : absDir,
          folderAbsolutePath: absDir,
          folderName: shortName || absDir,
          files: group.files,
        });
      }

      // 依資料夾名稱排序
      folderElements.sort((a, b) => a.folderName.localeCompare(b.folderName));
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
