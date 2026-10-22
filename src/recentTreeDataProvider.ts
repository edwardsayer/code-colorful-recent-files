import * as path from 'node:path';
import * as vscode from 'vscode';
import { getExtensionConfig } from './config';
import { RecentFilesManager } from './recentFilesManager';
import { HeatmapLevel, RECENT_SCHEME, RecentFileRecord, RecentFolderElement, RecentTreeElement } from './types';
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
      // 資料夾只顯示最後一段名稱，完整相對路徑放 tooltip (hint)
      const item = new vscode.TreeItem(element.folderName, vscode.TreeItemCollapsibleState.Expanded);
      item.iconPath = new vscode.ThemeIcon('folder');
      item.description = `${element.files.length}`;
      item.tooltip = element.folderPath;
      item.contextValue = 'folderItem';
      return item;
    }

    // element.kind === 'file'
    const originalFileUri = vscode.Uri.parse(element.record.uri);
    // 使用專屬 scheme，以利 FileDecoration 僅局部裝飾自家 TreeView，不污染原生 Explorer
    const viewItemUri = originalFileUri.with({ scheme: RECENT_SCHEME });

    const item = new vscode.TreeItem(viewItemUri, vscode.TreeItemCollapsibleState.None);
    const config = getExtensionConfig();

    // 依使用者需求：檔案不用顯示小字描述，資訊移至右方數字/時間標注
    item.description = undefined;
    // tooltip 維持原生，不額外附加自訂訊息
    item.tooltip = undefined;

    // 只有在使用者明確啟用 showColorDotIcon 時，才顯示色彩小圓點，預設維持原生檔案 icon
    if (config.showColorDotIcon) {
      if (config.colorScheme === 'rankSpectrum') {
        const rankInfo = this.manager.getRecordRank(element.record.uri);
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
      // 預設不覆寫 iconPath，由 VS Code 依副檔名自動套用使用者安裝的 File Icon Theme
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
        // 依需求：只顯示最後一段名稱
        let shortName = folderPath;
        if (folderPath === '.') {
          shortName = '工作區根目錄';
        } else {
          shortName = path.basename(folderPath);
        }

        folderElements.push({
          kind: 'folder',
          folderPath,
          folderName: shortName,
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
