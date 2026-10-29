import { describe, expect, it } from 'vitest';
import {
  canModifyFiles,
  dirGroupKey,
  isPathWithin,
  isSafeMove,
  isSamePath,
  isValidEntryName,
  removePinnedDirKeys,
  removeRecordPaths,
  rewritePinnedDirKeys,
  rewriteRecordPaths,
  UNDO_STACK_LIMIT,
  UndoStack,
  type PathRecord,
} from '../../src/util/fileOps';

// 測試一律以 win32 規則執行，讓 Windows 專屬驗證在任何主機上都成立。
const WIN = 'win32' as NodeJS.Platform;
const LINUX = 'linux' as NodeJS.Platform;

describe('isValidEntryName', () => {
  it('accepts ordinary names', () => {
    for (const name of ['a.txt', 'report-2026.md', 'sub dir', 'UPPER.TXT', 'a.b.c', '檔案.txt']) {
      expect(isValidEntryName(name, WIN)).toBe(true);
    }
  });

  it('rejects empty, whitespace-padded and traversal names', () => {
    for (const name of ['', '   ', ' a.txt', 'a.txt ', '.', '..']) {
      expect(isValidEntryName(name, WIN)).toBe(false);
    }
  });

  it('rejects names containing path separators or NUL', () => {
    for (const name of ['a/b', 'a\\b', 'a\0b']) {
      expect(isValidEntryName(name, WIN)).toBe(false);
    }
  });

  it('rejects Windows-reserved characters, trailing dot and trailing space', () => {
    for (const name of ['a<b', 'a>b', 'a:b', 'a"b', 'a|b', 'a?b', 'a*', 'trailing.', 'trailing ']) {
      expect(isValidEntryName(name, WIN)).toBe(false);
    }
  });

  it('rejects Windows device names, including with an extension', () => {
    for (const name of ['CON', 'con', 'PRN', 'AUX', 'NUL', 'COM1', 'COM9', 'LPT1', 'LPT9', 'CON.txt', 'nul.log']) {
      expect(isValidEntryName(name, WIN)).toBe(false);
    }
  });

  it('does not treat device-name-like prefixes as reserved', () => {
    for (const name of ['CONSOLE.txt', 'COM10', 'LPT10', 'AUXILIARY.md']) {
      expect(isValidEntryName(name, WIN)).toBe(true);
    }
  });

  it('applies only the platform-independent rules on posix', () => {
    // ':' 與 '<' 在 Linux 合法；裝置名規則不適用
    expect(isValidEntryName('a:b', LINUX)).toBe(true);
    expect(isValidEntryName('CON', LINUX)).toBe(true);
    expect(isValidEntryName('a/b', LINUX)).toBe(false);
    expect(isValidEntryName('..', LINUX)).toBe(false);
  });
});

describe('isSamePath', () => {
  it('ignores case on win32', () => {
    expect(isSamePath('C:\\proj\\A.txt', 'c:/proj/a.TXT', WIN)).toBe(true);
  });

  it('respects case on posix', () => {
    expect(isSamePath('/proj/A.txt', '/proj/a.txt', LINUX)).toBe(false);
    expect(isSamePath('/proj/A.txt', '/proj/A.txt', LINUX)).toBe(true);
  });

  it('normalises separators and redundant segments', () => {
    expect(isSamePath('C:\\proj\\.\\a.txt', 'C:/proj/a.txt', WIN)).toBe(true);
  });
});

describe('isSafeMove', () => {
  it('always allows moving files', () => {
    expect(isSafeMove('C:\\a\\f.txt', 'C:\\a\\f.txt', false)).toBe(true);
    expect(isSafeMove('C:\\a\\dir', 'C:\\a\\dir\\sub', false)).toBe(true);
  });

  it('rejects moving a directory into itself', () => {
    expect(isSafeMove('C:\\a\\dir', 'C:\\a\\dir', true)).toBe(false);
    expect(isSafeMove('C:\\a\\dir', 'C:\\a\\dir\\', true)).toBe(false);
  });

  it('rejects moving a directory into its own descendant', () => {
    expect(isSafeMove('C:\\a\\dir', 'C:\\a\\dir\\sub', true)).toBe(false);
    expect(isSafeMove('C:\\a\\dir', 'C:\\a\\dir\\sub\\deep', true)).toBe(false);
  });

  it('allows moving a directory to a sibling or an ancestor', () => {
    expect(isSafeMove('C:\\a\\dir', 'C:\\a\\other', true)).toBe(true);
    expect(isSafeMove('C:\\a\\dir', 'C:\\a', true)).toBe(true);
    expect(isSafeMove('C:\\a\\dir', 'D:\\elsewhere', true)).toBe(true);
  });

  it('does not treat a name-prefixed sibling as a descendant', () => {
    // 詞法比較：dir 與 dir2 是兄弟，不是父子
    expect(isSafeMove('C:\\a\\dir', 'C:\\a\\dir2', true)).toBe(true);
  });
});

describe('isPathWithin', () => {
  it('matches the path itself and its descendants', () => {
    expect(isPathWithin('C:\\a', 'C:\\a', WIN)).toBe(true);
    expect(isPathWithin('C:\\a', 'C:\\a\\b.txt', WIN)).toBe(true);
    expect(isPathWithin('C:\\a', 'C:\\a\\b\\c.txt', WIN)).toBe(true);
  });

  it('does not match siblings that share a string prefix', () => {
    expect(isPathWithin('C:\\proj\\a', 'C:\\proj\\ab', WIN)).toBe(false);
    expect(isPathWithin('C:\\proj\\a', 'C:\\proj\\ab\\c.txt', WIN)).toBe(false);
  });

  it('does not match parents or unrelated paths', () => {
    expect(isPathWithin('C:\\a\\b', 'C:\\a', WIN)).toBe(false);
    expect(isPathWithin('C:\\a', 'D:\\a', WIN)).toBe(false);
  });

  it('is case-insensitive on win32 and case-sensitive on posix', () => {
    expect(isPathWithin('C:\\Proj', 'c:\\proj\\f.txt', WIN)).toBe(true);
    expect(isPathWithin('/proj', '/Proj/f.txt', LINUX)).toBe(false);
  });
});

describe('UndoStack', () => {
  it('is LIFO', () => {
    const stack = new UndoStack();
    stack.push({ from: 'a', to: 'b', kind: 'rename' });
    stack.push({ from: 'c', to: 'd', kind: 'move' });
    expect(stack.peek()?.to).toBe('d');
    expect(stack.pop()?.to).toBe('d');
    expect(stack.peek()?.to).toBe('b');
    expect(stack.size).toBe(1);
  });

  it('returns undefined when empty', () => {
    const stack = new UndoStack();
    expect(stack.peek()).toBeUndefined();
    expect(stack.pop()).toBeUndefined();
    expect(stack.size).toBe(0);
  });

  it('drops the oldest entry beyond the limit', () => {
    const stack = new UndoStack();
    for (let i = 0; i < UNDO_STACK_LIMIT + 5; i++) {
      stack.push({ from: `from-${i}`, to: `to-${i}`, kind: 'move' });
    }
    expect(stack.size).toBe(UNDO_STACK_LIMIT);
    // 最新的一定還在
    expect(stack.peek()?.from).toBe(`from-${UNDO_STACK_LIMIT + 4}`);
    // 最舊的已被丟棄：連續 pop 到最後應為 from-5
    let last: string | undefined;
    while (stack.size > 0) last = stack.pop()?.from;
    expect(last).toBe('from-5');
  });

  it('can be cleared', () => {
    const stack = new UndoStack();
    stack.push({ from: 'a', to: 'b', kind: 'rename' });
    stack.clear();
    expect(stack.size).toBe(0);
    expect(stack.peek()).toBeUndefined();
  });
});

describe('canModifyFiles', () => {
  it('mirrors workspace trust', () => {
    expect(canModifyFiles(true)).toBe(true);
    expect(canModifyFiles(false)).toBe(false);
  });
});

const record = (fsPath: string, lastOpenedTime = 100, lastModifiedTime = 50): PathRecord => ({
  uri: `file:///${fsPath.replace(/\\/g, '/').replace(/^\/+/, '')}`,
  fsPath,
  lastOpenedTime,
  lastModifiedTime,
});

describe('rewriteRecordPaths', () => {
  it('rewrites an exact match and preserves timestamps', () => {
    const input = [record('C:\\proj\\a.txt', 111, 222)];
    const [out] = rewriteRecordPaths(input, 'C:\\proj\\a.txt', 'C:\\proj\\b.txt', WIN);
    expect(out.fsPath).toBe('C:\\proj\\b.txt');
    expect(out.lastOpenedTime).toBe(111);
    expect(out.lastModifiedTime).toBe(222);
    expect(out.uri).toContain('b.txt');
  });

  it('rewrites descendants of a moved directory, keeping the relative suffix', () => {
    const input = [record('C:\\proj\\dir\\a.txt'), record('C:\\proj\\dir\\sub\\b.txt')];
    const out = rewriteRecordPaths(input, 'C:\\proj\\dir', 'C:\\proj\\moved', WIN);
    expect(out.map((r) => r.fsPath)).toEqual(['C:\\proj\\moved\\a.txt', 'C:\\proj\\moved\\sub\\b.txt']);
  });

  it('leaves unrelated paths untouched', () => {
    const input = [record('C:\\other\\x.txt')];
    const [out] = rewriteRecordPaths(input, 'C:\\proj\\a.txt', 'C:\\proj\\b.txt', WIN);
    expect(out.fsPath).toBe('C:\\other\\x.txt');
  });

  it('does not rewrite a sibling that only shares a string prefix', () => {
    const input = [record('C:\\proj\\ab\\x.txt')];
    const [out] = rewriteRecordPaths(input, 'C:\\proj\\a', 'C:\\proj\\z', WIN);
    expect(out.fsPath).toBe('C:\\proj\\ab\\x.txt');
  });

  it('matches case-insensitively on win32', () => {
    const input = [record('c:\\PROJ\\A.TXT')];
    const [out] = rewriteRecordPaths(input, 'C:\\proj\\a.txt', 'C:\\proj\\renamed.txt', WIN);
    expect(out.fsPath).toBe('C:\\proj\\renamed.txt');
  });

  it('does not mutate the input array or its records', () => {
    const input = [record('C:\\proj\\a.txt')];
    const snapshot = JSON.parse(JSON.stringify(input));
    rewriteRecordPaths(input, 'C:\\proj\\a.txt', 'C:\\proj\\b.txt', WIN);
    expect(input).toEqual(snapshot);
  });
});

describe('removeRecordPaths', () => {
  it('removes the target and all of its descendants', () => {
    const input = [
      record('C:\\proj\\dir\\a.txt'),
      record('C:\\proj\\dir\\sub\\b.txt'),
      record('C:\\proj\\keep.txt'),
    ];
    const out = removeRecordPaths(input, 'C:\\proj\\dir', WIN);
    expect(out.map((r) => r.fsPath)).toEqual(['C:\\proj\\keep.txt']);
  });

  it('removes only the exact file when target is a file', () => {
    const input = [record('C:\\proj\\a.txt'), record('C:\\proj\\a.txt.bak')];
    const out = removeRecordPaths(input, 'C:\\proj\\a.txt', WIN);
    expect(out.map((r) => r.fsPath)).toEqual(['C:\\proj\\a.txt.bak']);
  });

  it('leaves the list unchanged when nothing matches', () => {
    const input = [record('C:\\proj\\a.txt')];
    expect(removeRecordPaths(input, 'C:\\nope', WIN)).toHaveLength(1);
  });
});

describe('dirGroupKey', () => {
  it('lowercases and prefixes the path', () => {
    expect(dirGroupKey('C:\\Proj\\Dir')).toBe('dir:c:\\proj\\dir');
  });
});

describe('rewritePinnedDirKeys', () => {
  it('rewrites the matching dir key and keeps order', () => {
    const order = ['dir:c:\\proj\\dir', 'type:ts', 'dir:c:\\proj\\other'];
    const out = rewritePinnedDirKeys(order, 'C:\\proj\\dir', 'C:\\proj\\moved', WIN);
    expect(out).toEqual(['dir:c:\\proj\\moved', 'type:ts', 'dir:c:\\proj\\other']);
  });

  it('rewrites descendant dir keys with the relative suffix', () => {
    const order = ['dir:c:\\proj\\dir\\sub'];
    const out = rewritePinnedDirKeys(order, 'C:\\proj\\dir', 'C:\\proj\\moved', WIN);
    expect(out).toEqual(['dir:c:\\proj\\moved\\sub']);
  });

  it('never touches type keys', () => {
    const order = ['type:ts', 'type:json'];
    expect(rewritePinnedDirKeys(order, 'C:\\proj\\dir', 'C:\\proj\\moved', WIN)).toEqual(order);
  });

  it('deduplicates when a rewrite collides with an existing key, keeping the first occurrence', () => {
    const order = ['dir:c:\\proj\\a', 'dir:c:\\proj\\b'];
    // 把 a 搬到 b 的位置 → 兩個 key 相同，只保留先出現的
    const out = rewritePinnedDirKeys(order, 'C:\\proj\\a', 'C:\\proj\\b', WIN);
    expect(out).toEqual(['dir:c:\\proj\\b']);
  });

  it('leaves unrelated keys untouched', () => {
    const order = ['dir:c:\\elsewhere'];
    expect(rewritePinnedDirKeys(order, 'C:\\proj\\dir', 'C:\\proj\\moved', WIN)).toEqual(order);
  });
});

describe('removePinnedDirKeys', () => {
  it('removes the target dir key and its descendants but keeps type keys', () => {
    const order = ['dir:c:\\proj\\dir', 'dir:c:\\proj\\dir\\sub', 'type:ts', 'dir:c:\\proj\\keep'];
    const out = removePinnedDirKeys(order, 'C:\\proj\\dir', WIN);
    expect(out).toEqual(['type:ts', 'dir:c:\\proj\\keep']);
  });

  it('does not remove a sibling sharing a string prefix', () => {
    const order = ['dir:c:\\proj\\ab'];
    expect(removePinnedDirKeys(order, 'C:\\proj\\a', WIN)).toEqual(['dir:c:\\proj\\ab']);
  });
});
