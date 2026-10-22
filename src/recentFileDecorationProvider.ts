import * as vscode from 'vscode';
import { getExtensionConfig } from './config';
import { RecentFilesManager } from './recentFilesManager';
import { HeatmapLevel, RECENT_FOLDER_SCHEME, RECENT_SCHEME } from './types';
import { getSpectrumThemeColorId } from './util/color';
import { calculateHeatmapLevel, formatRelativeTime, getMetricTime } from './util/time';

export class RecentFileDecorationProvider implements vscode.FileDecorationProvider {
  private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
  public readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  constructor(private readonly manager: RecentFilesManager) {
    this.manager.onDidChangeRecentFiles(() => {
      this._onDidChangeFileDecorations.fire(undefined);
    });
  }

  public fireChange(): void {
    this._onDidChangeFileDecorations.fire(undefined);
  }

  /** 計算指定檔案路徑在當前模式下的 ThemeColor */
  private getFileThemeColorId(fsPath: string): string | undefined {
    const record = this.manager.getRecordByFsPath(fsPath);
    if (!record) return undefined;

    const config = getExtensionConfig();
    const metricTime = getMetricTime(record, config.highlightMode);

    if (config.colorScheme === 'rankSpectrum') {
      const rankInfo = this.manager.getRecordRank(record.fsPath);
      if (rankInfo) {
        const { rank, total } = rankInfo;
        const t = total > 1 ? rank / (total - 1) : 0;
        return getSpectrumThemeColorId(t);
      }
      return 'charts.red';
    } else {
      const level = calculateHeatmapLevel(metricTime);
      switch (level) {
        case HeatmapLevel.Fresh:
          return 'charts.green';
        case HeatmapLevel.Warm:
          return 'charts.yellow';
        case HeatmapLevel.Day:
          return 'charts.orange';
        case HeatmapLevel.Old:
        default:
          return undefined;
      }
    }
  }

  public provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    // 1. 資料夾節點處理：顯示檔案數量，且顏色與該資料夾內第一筆 (最新) 檔案相同
    if (uri.scheme === RECENT_FOLDER_SCHEME) {
      const params = new URLSearchParams(uri.query);
      const count = params.get('count') || '';
      const primaryPath = params.get('primary') ? decodeURIComponent(params.get('primary')!) : undefined;

      let folderColorId: string | undefined;
      if (primaryPath) {
        folderColorId = this.getFileThemeColorId(primaryPath);
      }

      return {
        badge: count,
        color: folderColorId ? new vscode.ThemeColor(folderColorId) : new vscode.ThemeColor('descriptionForeground'),
        tooltip: undefined,
      };
    }

    const config = getExtensionConfig();

    // 2. 原生 Explorer 隔離：未啟用 styleNativeExplorer 時，非自訂 scheme 的項目一律不裝飾
    if (!config.styleNativeExplorer && uri.scheme !== RECENT_SCHEME) {
      return undefined;
    }

    // 從 query 或 fsPath 取得安全準確的本機路徑
    let targetFsPath = uri.fsPath;
    if (uri.scheme === RECENT_SCHEME && uri.query) {
      try {
        const params = new URLSearchParams(uri.query);
        const qPath = params.get('fsPath');
        if (qPath) {
          targetFsPath = decodeURIComponent(qPath);
        }
      } catch {
        // 退回 uri.fsPath
      }
    }

    const record = this.manager.getRecordByFsPath(targetFsPath);
    if (!record) {
      return undefined;
    }

    const metricTime = getMetricTime(record, config.highlightMode);
    const timeStr = formatRelativeTime(metricTime);

    // 取得順位編號 (1-indexed)
    const rankInfo = this.manager.getRecordRank(record.fsPath);
    const rankNumber = rankInfo ? rankInfo.rank + 1 : 1;

    // 依使用者指示：不管是哪種顯示模式，Badge 都顯示 "#1 剛剛"、"#2 5m"、"#3 1h"
    const badgeText = `#${rankNumber} ${timeStr}`;

    const themeColorId = this.getFileThemeColorId(record.fsPath);
    if (!themeColorId) {
      return undefined;
    }

    return {
      badge: badgeText,
      color: new vscode.ThemeColor(themeColorId),
      tooltip: undefined,
    };
  }
}
