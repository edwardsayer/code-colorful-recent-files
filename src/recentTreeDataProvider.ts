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
import { calculateHeatmapLevel, formatRelativeTime, getMetricTime } from './util/time';
import { getFileTypeGroup } from './util/typeGroup';

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
      // 資料夾 URI 攜帶檔案數量與該資料夾內第一筆 (最新) 檔案路徑，供顏色與標注連動
      const folderFsUri = vscode.Uri.file(element.folderAbsolutePath);
      const query = `count=${element.files.length}&primary=${encodeURIComponent(element.primaryFileFsPath || '')}`;
      const viewFolderUri = vscode.Uri.from({
        scheme: RECENT_FOLDER_SCHEME,
        path: folderFsUri.path,
        query,
      });

      const item = new vscode.TreeItem(viewFolderUri, vscode.TreeItemCollapsibleState.Expanded);
      item.label = element.folderName;
      item.description = undefined;
      // Hint (Tooltip)
      item.tooltip = element.groupKind === 'type'
        ? `${element.folderName} (${element.files.length} items)`
        : element.folderAbsolutePath;
      item.contextValue = 'folderItem';

      return item;
    }

    // element.kind === 'file'
    const originalFileUri = vscode.Uri.file(element.record.fsPath);
    // 專屬 scheme 隔離原生 Explorer，並以 query 攜帶精準本機絕對路徑
    const viewItemUri = vscode.Uri.from({
      scheme: RECENT_SCHEME,
      path: originalFileUri.path,
      query: `fsPath=${encodeURIComponent(element.record.fsPath)}`,
    });

    const item = new vscode.TreeItem(viewItemUri, vscode.TreeItemCollapsibleState.None);
    const config = getExtensionConfig();

    const metricTime = getMetricTime(element.record, config.highlightMode);
    const timeStr = formatRelativeTime(metricTime);
    const rankInfo = this.manager.getRecordRank(element.record.fsPath);
    const rankNumber = rankInfo ? rankInfo.rank + 1 : 1;

    // ★ 關鍵呈現：在 description 中完整呈現序號與時間 (例如 "#1 剛剛"、"#2 5m")
    item.description = `#${rankNumber} • ${timeStr}`;
    item.tooltip = undefined;

    // 只有在使用者明確勾選 showColorDotIcon 時，才顯示色彩小圓點，預設維持原生檔案主題圖示
    if (config.showColorDotIcon) {
      if (config.colorScheme === 'rankSpectrum' || config.colorScheme === 'plainText') {
        if (rankInfo) {
          const { rank, total } = rankInfo;
          const t = total > 1 ? rank / (total - 1) : 0;
          const isLight =
            vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Light ||
            vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.HighContrastLight;
          const colorHex = interpolateRainbow(t, isLight);
          item.iconPath = vscode.Uri.parse(createColorDotSvgDataUri(colorHex));
        }
      } else {
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
      item.iconPath = undefined;
    }

    // 點擊事件：委派給自訂 openFile 指令，主動更新時間並置頂
    item.command = {
      command: 'codeColorfulRecentFiles.openFile',
      title: 'Open File',
      arguments: [originalFileUri],
    };

    item.contextValue = 'fileItem';
    return item;
  }

  public getChildren(element?: RecentTreeElement): vscode.ProviderResult<RecentTreeElement[]> {
    const config = getExtensionConfig();
    const records = this.manager.getVisibleRecords();

    if (!element) {
      // 根層級：平鋪模式
      if (config.groupBy === 'none') {
        return records.map((record) => ({
          kind: 'file',
          record,
        }));
      }

      const folderElements: RecentFolderElement[] = [];

      if (config.groupBy === 'type') {
        // 依檔案類型 (副檔名大寫) 分組
        const typeGroups = new Map<string, RecentFileRecord[]>();
        for (const record of records) {
          const typeName = getFileTypeGroup(record.fsPath);
          const list = typeGroups.get(typeName);
          if (list) {
            list.push(record);
          } else {
            typeGroups.set(typeName, [record]);
          }
        }

        for (const [typeName, files] of typeGroups.entries()) {
          const sortedFiles = [...files].sort((a, b) => {
            const timeA = Math.max(a.lastOpenedTime || 0, a.lastModifiedTime || 0);
            const timeB = Math.max(b.lastOpenedTime || 0, b.lastModifiedTime || 0);
            return timeB - timeA;
          });
          const primaryFile = sortedFiles[0];

          folderElements.push({
            kind: 'folder',
            groupKind: 'type',
            folderKey: `type:${typeName}`,
            folderPath: typeName,
            folderAbsolutePath: primaryFile ? primaryFile.fsPath : typeName,
            folderName: typeName,
            files: sortedFiles,
            primaryFileFsPath: primaryFile?.fsPath,
          });
        }
      } else {
        // 依目錄分組 (groupBy === 'directory')
        const dirGroups = new Map<string, { folderAbsolutePath: string; files: RecentFileRecord[] }>();
        for (const record of records) {
          const fileDir = path.dirname(record.fsPath);
          const folderKey = fileDir.toLowerCase();

          const group = dirGroups.get(folderKey);
          if (group) {
            group.files.push(record);
          } else {
            dirGroups.set(folderKey, {
              folderAbsolutePath: fileDir,
              files: [record],
            });
          }
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspaceRoot = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : undefined;

        for (const group of dirGroups.values()) {
          const absDir = group.folderAbsolutePath;
          let shortName = path.basename(absDir);

          if (workspaceRoot && path.normalize(absDir).toLowerCase() === path.normalize(workspaceRoot).toLowerCase()) {
            shortName = '工作區根目錄';
          }

          const sortedFiles = [...group.files].sort((a, b) => {
            const timeA = Math.max(a.lastOpenedTime || 0, a.lastModifiedTime || 0);
            const timeB = Math.max(b.lastOpenedTime || 0, b.lastModifiedTime || 0);
            return timeB - timeA;
          });

          folderElements.push({
            kind: 'folder',
            groupKind: 'directory',
            folderKey: `dir:${absDir.toLowerCase()}`,
            folderPath: workspaceRoot ? path.relative(workspaceRoot, absDir) || '.' : absDir,
            folderAbsolutePath: absDir,
            folderName: shortName || absDir,
            files: sortedFiles,
            primaryFileFsPath: sortedFiles[0]?.fsPath,
          });
        }
      }

      // 三重排序調度器：latest / name / manual
      if (config.folderSortOrder === 'name') {
        folderElements.sort((a, b) => a.folderName.localeCompare(b.folderName));
      } else if (config.folderSortOrder === 'manual') {
        const manualOrder = this.manager.getFolderManualOrder();
        // 補充尚未登記在 manualOrder 中的資料夾 (確保每個 folderKey 皆有固定 index，點擊檔案絕不跳動)
        const missingKeys = folderElements.filter((f) => !manualOrder.includes(f.folderKey)).map((f) => f.folderKey);
        if (missingKeys.length > 0) {
          manualOrder.push(...missingKeys);
          this.manager.setFolderManualOrder(manualOrder, false);
        }

        folderElements.sort((a, b) => {
          const idxA = manualOrder.indexOf(a.folderKey);
          const idxB = manualOrder.indexOf(b.folderKey);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.folderKey.localeCompare(b.folderKey);
        });
      } else {
        // 'latest' (預設)：依各資料夾最新活動時間由新到舊排序
        folderElements.sort((a, b) => {
          const timeA = a.files[0] ? Math.max(a.files[0].lastOpenedTime || 0, a.files[0].lastModifiedTime || 0) : 0;
          const timeB = b.files[0] ? Math.max(b.files[0].lastOpenedTime || 0, b.files[0].lastModifiedTime || 0) : 0;
          return timeB - timeA;
        });
      }

      return folderElements;
    }

    // 子層級：Folder 下的檔案 (已照時間由新到舊排序)
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
