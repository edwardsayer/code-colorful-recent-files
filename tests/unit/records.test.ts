import { describe, expect, it } from 'vitest';
import { RecentFileRecord } from '../../src/types';
import { normalizePathKey } from '../../src/util/pathUtil';

describe('recent records logic', () => {
  it('normalizes path keys correctly across platforms', () => {
    expect(normalizePathKey('D:\\Code\\File.ts')).toBe('d:\\code\\file.ts');
    expect(normalizePathKey('d:/code/file.ts')).toBe('d:\\code\\file.ts');
  });

  it('correctly sorts records by newest access or modification time', () => {
    const records: RecentFileRecord[] = [
      { uri: 'file:///a.ts', fsPath: 'd:/a.ts', lastOpenedTime: 100, lastModifiedTime: 100 },
      { uri: 'file:///b.ts', fsPath: 'd:/b.ts', lastOpenedTime: 500, lastModifiedTime: 200 },
      { uri: 'file:///c.ts', fsPath: 'd:/c.ts', lastOpenedTime: 300, lastModifiedTime: 800 },
    ];

    const sorted = records.sort((a, b) => {
      const timeA = Math.max(a.lastOpenedTime || 0, a.lastModifiedTime || 0);
      const timeB = Math.max(b.lastOpenedTime || 0, b.lastModifiedTime || 0);
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      return a.fsPath.localeCompare(b.fsPath);
    });

    expect(sorted.map((r) => r.uri)).toEqual([
      'file:///c.ts', // 800
      'file:///b.ts', // 500
      'file:///a.ts', // 100
    ]);
  });

  it('handles records with missing or zero time predictably', () => {
    const records: RecentFileRecord[] = [
      { uri: 'file:///newest.ts', fsPath: 'd:/newest.ts', lastOpenedTime: 1000, lastModifiedTime: 1000 },
      { uri: 'file:///zero.ts', fsPath: 'd:/zero.ts', lastOpenedTime: 0, lastModifiedTime: 0 },
      { uri: 'file:///mid.ts', fsPath: 'd:/mid.ts', lastOpenedTime: 500, lastModifiedTime: 500 },
    ];

    const sorted = records.sort((a, b) => {
      const timeA = Math.max(a.lastOpenedTime || 0, a.lastModifiedTime || 0);
      const timeB = Math.max(b.lastOpenedTime || 0, b.lastModifiedTime || 0);
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      return a.fsPath.localeCompare(b.fsPath);
    });

    // zero 必須排在最後 (最舊)，絕不可夾在中間！
    expect(sorted.map((r) => r.uri)).toEqual([
      'file:///newest.ts',
      'file:///mid.ts',
      'file:///zero.ts',
    ]);
  });
});
