import { describe, expect, it } from 'vitest';
import { RecentFileRecord } from '../../src/types';

describe('recent records logic', () => {
  it('correctly sorts records by newest access or modification time', () => {
    const records: RecentFileRecord[] = [
      { uri: 'file:///a.ts', fsPath: '/a.ts', lastOpenedTime: 100, lastModifiedTime: 100 },
      { uri: 'file:///b.ts', fsPath: '/b.ts', lastOpenedTime: 500, lastModifiedTime: 200 },
      { uri: 'file:///c.ts', fsPath: '/c.ts', lastOpenedTime: 300, lastModifiedTime: 800 },
    ];

    const sorted = records.sort((a, b) => {
      const timeA = Math.max(a.lastOpenedTime, a.lastModifiedTime);
      const timeB = Math.max(b.lastOpenedTime, b.lastModifiedTime);
      return timeB - timeA;
    });

    expect(sorted.map((r) => r.uri)).toEqual([
      'file:///c.ts', // 800
      'file:///b.ts', // 500
      'file:///a.ts', // 100
    ]);
  });
});
