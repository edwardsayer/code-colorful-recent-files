import * as vscode from 'vscode';
import { getExtensionConfig } from './config';
import { RecentFilesManager } from './recentFilesManager';
import { HeatmapLevel, RECENT_SCHEME } from './types';
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
    const config = getExtensionConfig();

    // 隔離原生 Explorer：若未啟用 styleNativeExplorer，則非 RECENT_SCHEME 的 URI 一律不裝飾
    if (!config.styleNativeExplorer && uri.scheme !== RECENT_SCHEME) {
      return undefined;
    }

    // 取得原始 file 協定之 URI 字串進行資料查詢
    const fileUriStr = uri.with({ scheme: 'file' }).toString();
    const record = this.manager.getRecordByUri(fileUriStr);
    if (!record) {
      return undefined;
    }

    const metricTime = getMetricTime(record, config.highlightMode);
    // 右方標注統一採用時間簡寫（如 剛剛, 5m, 1h, 2d），不論哪套上色方案
    const badgeText = formatRelativeTime(metricTime);

    // 依選定的配色方案決定 ThemeColor
    let themeColorId: string | undefined;

    if (config.colorScheme === 'rankSpectrum') {
      const rankInfo = this.manager.getRecordRank(fileUriStr);
      if (rankInfo) {
        const { rank, total } = rankInfo;
        const t = total > 1 ? rank / (total - 1) : 0;
        themeColorId = getSpectrumThemeColorId(t);
      }
    } else {
      // timeBucket 模式
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
      // tooltip 維持 undefined，不特別加上附加訊息，維持 VS Code 原生路徑顯示
      tooltip: undefined,
    };
  }
}
