import * as vscode from 'vscode';
import { getExtensionConfig } from './config';
import { RecentFilesManager } from './recentFilesManager';
import { HeatmapLevel } from './types';
import { calculateHeatmapLevel, formatRelativeTime, getMetricTime } from './util/time';

export class RecentFileDecorationProvider implements vscode.FileDecorationProvider {
  private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
  public readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  constructor(private readonly manager: RecentFilesManager) {
    // 當檔案活動更新時，通知 VS Code 更新裝飾
    this.manager.onDidChangeRecentFiles(() => {
      this._onDidChangeFileDecorations.fire(undefined);
    });
  }

  public provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    const record = this.manager.getRecordByUri(uri.toString());
    if (!record) {
      return undefined;
    }

    const config = getExtensionConfig();
    const metricTime = getMetricTime(record, config.highlightMode);
    const level = calculateHeatmapLevel(metricTime);
    const relativeTimeStr = formatRelativeTime(metricTime);

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
