import { describe, expect, it } from 'vitest';
import { selectDraggableFilePaths } from '../../src/util/dragPaths';
import type { RecentTreeElement } from '../../src/types';

const file = (fsPath: string): RecentTreeElement =>
  ({ kind: 'file', record: { fsPath } }) as unknown as RecentTreeElement;

const folder = (folderKey: string): RecentTreeElement =>
  ({ kind: 'folder', folderKey, isPinned: true }) as unknown as RecentTreeElement;

describe('selectDraggableFilePaths', () => {
  it('只輸出檔案節點的路徑，忽略分組節點', () => {
    const result = selectDraggableFilePaths([folder('type:ts'), file('/a/b.ts'), folder('dir:src')]);
    expect(result).toEqual(['/a/b.ts']);
  });

  it('保留多個檔案並維持原始順序', () => {
    const result = selectDraggableFilePaths([file('/a.md'), file('/b.ts'), file('/c.json')]);
    expect(result).toEqual(['/a.md', '/b.ts', '/c.json']);
  });

  it('同一路徑重複出現時只輸出一次', () => {
    const result = selectDraggableFilePaths([file('/a.md'), file('/a.md'), file('/b.md')]);
    expect(result).toEqual(['/a.md', '/b.md']);
  });

  it('空輸入回傳空陣列', () => {
    expect(selectDraggableFilePaths([])).toEqual([]);
  });

  it('忽略空字串與非字串路徑', () => {
    const bad = { kind: 'file', record: {} } as unknown as RecentTreeElement;
    const result = selectDraggableFilePaths([file(''), bad, file('/ok.md')]);
    expect(result).toEqual(['/ok.md']);
  });

  it('只有分組節點時回傳空陣列（不得把 folderKey 當檔案拖出）', () => {
    expect(selectDraggableFilePaths([folder('dir:src'), folder('type:ts')])).toEqual([]);
  });
});

// Windows 的路徑去重需大小寫不敏感；以平台條件式驗證，避免在非 Windows 上誤判。
describe.runIf(process.platform === 'win32')('selectDraggableFilePaths (win32 大小寫)', () => {
  it('C:/Repo 與 c:/repo 視為同一路徑', () => {
    const result = selectDraggableFilePaths([file('C:/Repo/a.ts'), file('c:/repo/a.ts')]);
    expect(result).toEqual(['C:/Repo/a.ts']);
  });
});
