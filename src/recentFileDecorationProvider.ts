import * as vscode from 'vscode';
import { getExtensionConfig } from './config';
import { RecentFilesManager } from './recentFilesManager';
import { HeatmapLevel } from './types';
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
    const record = this.manager.getRecordByUri(uri.toString());
    if (!record) {
      return undefined;
    }

    const config = getExtensionConfig();
    const metricTime = getMetricTime(record, config.highlightMode);
    const relativeTimeStr = formatRelativeTime(metricTime);

    // 方案 A: 順位彩虹光譜模式 (Rank-based Spectrum)
    if (config.colorScheme === 'rankSpectrum') {
      const rankInfo = this.manager.getRecordRank(uri.toString());
      if (!rankInfo) {
        return undefined;
      }

      const { rank, total } = rankInfo;
      // 避免除以 0：若只有 1 筆檔案，t = 0 (最新紅色)
      const t = total > 1 ? rank / (total - 1) : 0;
      const themeColorId = getSpectrumThemeColorId(t);
      const rankNumber = rank + 1;

      return {
        badge: `${rankNumber}`,
        color: new vscode.ThemeColor(themeColorId),
        tooltip: vscode.l10n.t('tooltip.rankSpectrum', rankNumber, total, relativeTimeStr),
      };
    }

    // 方案 B: 時間階梯模式 (Time Bucket)
    const level = calculateHeatmapLevel(metricTime);
    switch (level) {
      case HeatmapLevel.Fresh:
        return {
          badge: '●',
          color: new vscode.ThemeColor('charts.green'),
          tooltip: vscode.l10n.t('tooltip.accessed', relativeTimeStr),
        };
      case HeatmapLevel.Warm:
        return {
          badge: '1h',
          color: new vscode.ThemeColor('charts.yellow'),
          tooltip: vscode.l10n.t('tooltip.accessed', relativeTimeStr),
        };
      case HeatmapLevel.Day:
        return {
          badge: '1d',
          color: new vscode.ThemeColor('charts.orange'),
          tooltip: vscode.l10n.t('tooltip.accessed', relativeTimeStr),
        };
      case HeatmapLevel.Old:
      default:
        return undefined;
    }
  }
}
