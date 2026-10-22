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
    // 當檔案活動或設定更新時，通知 VS Code 更新裝飾
    this.manager.onDidChangeRecentFiles(() => {
      this._onDidChangeFileDecorations.fire(undefined);
    });
  }

  public fireChange(): void {
    this._onDidChangeFileDecorations.fire(undefined);
  }

  public provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    // 1. 資料夾右方標注：顯示檔案數量
    if (uri.scheme === RECENT_FOLDER_SCHEME) {
      const count = uri.query || '';
      if (!count) return undefined;
      return {
        badge: count,
        color: new vscode.ThemeColor('descriptionForeground'),
        tooltip: undefined,
      };
    }

    const config = getExtensionConfig();

    // 2. 隔離原生 Explorer：若未啟用 styleNativeExplorer，則非 RECENT_SCHEME 的檔案一律不裝飾
    if (!config.styleNativeExplorer && uri.scheme !== RECENT_SCHEME) {
      return undefined;
    }

    // 透過本機路徑 canonical key 查詢，徹底杜絕 Windows 磁碟機大小寫或協定前綴差異
    const record = this.manager.getRecordByFsPath(uri.fsPath);
    if (!record) {
      return undefined;
    }

    const metricTime = getMetricTime(record, config.highlightMode);
    const timeStr = formatRelativeTime(metricTime);

    let themeColorId: string | undefined;
    let badgeText = timeStr;

    // 方案 A: 順位彩虹漸層光譜模式
    if (config.colorScheme === 'rankSpectrum') {
      const rankInfo = this.manager.getRecordRank(record.fsPath);
      if (rankInfo) {
        const { rank, total } = rankInfo;
        const t = total > 1 ? rank / (total - 1) : 0;
        themeColorId = getSpectrumThemeColorId(t);
        const rankNumber = rank + 1;
        // 加回存取序號標注：例如 "#1 剛剛" 或 "#1 5m"
        badgeText = `#${rankNumber} ${timeStr}`;
      } else {
        themeColorId = 'charts.red';
      }
    } else {
      // 方案 B: 時間階梯模式
      const level = calculateHeatmapLevel(metricTime);
      switch (level) {
        case HeatmapLevel.Fresh:
          themeColorId = 'charts.green';
          break;
        case HeatmapLevel.Warm:
          themeColorId = 'charts.yellow';
          break;
        case HeatmapLevel.Day:
          themeColorId = 'charts.orange';
          break;
        case HeatmapLevel.Old:
        default:
          themeColorId = undefined;
          break;
      }
    }

    if (!themeColorId) {
      return undefined;
    }

    return {
      badge: badgeText,
      color: new vscode.ThemeColor(themeColorId),
      // tooltip 維持原生，不額外附加自訂訊息
      tooltip: undefined,
    };
  }
}
