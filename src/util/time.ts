import { HeatmapLevel, RecentFileRecord } from '../types';

export const FIFTEEN_MINUTES = 15 * 60 * 1000;
export const TWO_HOURS = 2 * 60 * 60 * 1000;
export const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

/**
 * 依據設定之熱度模式取得基準時間
 */
export function getMetricTime(record: RecentFileRecord, mode: 'lastAccess' | 'lastModified'): number {
  if (mode === 'lastModified') {
    return record.lastModifiedTime;
  }
  return Math.max(record.lastOpenedTime, record.lastModifiedTime);
}

/**
 * 計算指定時間與當前時間之差，並判定熱度等級
 */
export function calculateHeatmapLevel(time: number, now = Date.now()): HeatmapLevel {
  const diff = Math.max(0, now - time);
  if (diff < FIFTEEN_MINUTES) {
    return HeatmapLevel.Fresh;
  }
  if (diff < TWO_HOURS) {
    return HeatmapLevel.Warm;
  }
  if (diff < TWENTY_FOUR_HOURS) {
    return HeatmapLevel.Day;
  }
  return HeatmapLevel.Old;
}

/**
 * 格式化相對時間描述（簡潔標籤，例如 "剛剛" / "5m ago"）
 */
export function formatRelativeTime(time: number, now = Date.now()): string {
  const diffMs = Math.max(0, now - time);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) {
    return '剛剛';
  }
  if (diffMin < 60) {
    return `${diffMin}m`;
  }
  if (diffHour < 24) {
    return `${diffHour}h`;
  }
  return `${diffDay}d`;
}
