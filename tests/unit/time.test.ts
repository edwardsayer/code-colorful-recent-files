import { describe, expect, it } from 'vitest';
import { HeatmapLevel, RecentFileRecord } from '../../src/types';
import {
  calculateHeatmapLevel,
  FIFTEEN_MINUTES,
  formatRelativeTime,
  getGroupLatestActivity,
  getMetricTime,
  TWENTY_FOUR_HOURS,
  TWO_HOURS,
} from '../../src/util/time';

describe('time utility', () => {
  it('correctly calculates heatmap levels', () => {
    const now = 1700000000000;

    // 5 分鐘前 -> Fresh
    expect(calculateHeatmapLevel(now - 5 * 60 * 1000, now)).toBe(HeatmapLevel.Fresh);

    // 14.9 分鐘前 -> Fresh
    expect(calculateHeatmapLevel(now - (FIFTEEN_MINUTES - 1000), now)).toBe(HeatmapLevel.Fresh);

    // 16 分鐘前 -> Warm
    expect(calculateHeatmapLevel(now - 16 * 60 * 1000, now)).toBe(HeatmapLevel.Warm);

    // 1.9 小時前 -> Warm
    expect(calculateHeatmapLevel(now - (TWO_HOURS - 1000), now)).toBe(HeatmapLevel.Warm);

    // 3 小時前 -> Day
    expect(calculateHeatmapLevel(now - 3 * 60 * 60 * 1000, now)).toBe(HeatmapLevel.Day);

    // 23.9 小時前 -> Day
    expect(calculateHeatmapLevel(now - (TWENTY_FOUR_HOURS - 1000), now)).toBe(HeatmapLevel.Day);

    // 25 小時前 -> Old
    expect(calculateHeatmapLevel(now - 25 * 60 * 60 * 1000, now)).toBe(HeatmapLevel.Old);
  });

  it('correctly formats relative time strings', () => {
    const now = 1700000000000;

    expect(formatRelativeTime(now - 30 * 1000, now)).toBe('just now');
    expect(formatRelativeTime(now - 5 * 60 * 1000, now)).toBe('5m');
    expect(formatRelativeTime(now - 3 * 60 * 60 * 1000, now)).toBe('3h');
    expect(formatRelativeTime(now - 48 * 60 * 60 * 1000, now)).toBe('2d');
  });

  it('correctly picks metric time based on mode', () => {
    const record: RecentFileRecord = {
      uri: 'file:///test.ts',
      fsPath: '/test.ts',
      lastOpenedTime: 1000,
      lastModifiedTime: 2000,
    };

    expect(getMetricTime(record, 'lastModified')).toBe(2000);
    expect(getMetricTime(record, 'lastAccess')).toBe(2000);

    const recordOpenedLater: RecentFileRecord = {
      uri: 'file:///test2.ts',
      fsPath: '/test2.ts',
      lastOpenedTime: 5000,
      lastModifiedTime: 3000,
    };

    expect(getMetricTime(recordOpenedLater, 'lastModified')).toBe(3000);
    expect(getMetricTime(recordOpenedLater, 'lastAccess')).toBe(5000);
  });
});

describe('getGroupLatestActivity', () => {
  const rec = (fsPath: string, lastOpenedTime: number, lastModifiedTime: number) => ({
    uri: `file:///${fsPath}`,
    fsPath,
    lastOpenedTime,
    lastModifiedTime,
  });

  it('returns the max metric time regardless of input order', () => {
    const records = [rec('a', 100, 900), rec('b', 500, 200), rec('c', 300, 300)];
    expect(getGroupLatestActivity(records, 'lastAccess')).toBe(900);
    expect(getGroupLatestActivity(records, 'lastModified')).toBe(900);
  });

  it('follows the selected metric instead of max(opened, modified)', () => {
    const records = [rec('a', 999, 10), rec('b', 20, 30)];
    // lastAccess 取 max(opened, modified) → 999；lastModified 只看 modified → 30
    expect(getGroupLatestActivity(records, 'lastAccess')).toBe(999);
    expect(getGroupLatestActivity(records, 'lastModified')).toBe(30);
  });

  it('returns 0 for empty groups and ignores non-finite values', () => {
    expect(getGroupLatestActivity([], 'lastAccess')).toBe(0);
    expect(getGroupLatestActivity([rec('a', NaN, NaN)], 'lastAccess')).toBe(0);
  });
});
