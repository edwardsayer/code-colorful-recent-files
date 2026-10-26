import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 回歸測試：守住兩個曾在 pre-release gate 被抓到的缺陷。
 *
 * 1. `VND_URI_LIST_MIME`（`application/vnd.code.uri-list`）只被 `set()` 而沒有列進
 *    `dragMimeTypes`。VS Code 只為**已宣告**的類型建立 drag 階段佔位 entry，
 *    未宣告者在 renderer log 產生 `does not declare them in dragMimeTypes` warning，
 *    且對外落點看不到該 MIME —— 等於該次改動完全無效（0.3.1 regression）。
 *
 * 2. `createTreeView()` 未開 `canSelectMany`，導致多選拖曳（以及 `dragPaths` 的
 *    去重與 CRLF 多檔序列化）在 UI 上永遠無法觸發。
 *
 * 這兩項都無法用純邏輯單元測試覆蓋（需要 `vscode` 模組），
 * 故以原始碼契約斷言守住。
 *
 * 已知限制（reviewer F3）：本檔為**原始碼字串契約**，不是 AST 或執行期驗證。
 * 為避免註解／字串造成假陽性，所有斷言前都先移除註解。
 * 它應被視為低成本 regression guard，**不得**作為執行期行為的證明。
 */
const projectRoot = join(__dirname, '..', '..');

/** 移除區塊註解與行註解，避免註解文字誤滿足斷言。 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('//');
      if (idx === -1) return line;
      // 若 `//` 之前的引號數為奇數，視為字串內容，不當作註解
      const before = line.slice(0, idx);
      const quotes = (before.match(/'/g) || []).length + (before.match(/"/g) || []).length;
      return quotes % 2 === 1 ? line : before;
    })
    .join('\n');
}

const readStripped = (relative: string): string =>
  stripComments(readFileSync(join(projectRoot, relative), 'utf8'));

describe('treeDragAndDrop 的 MIME 宣告契約', () => {
  const source = readStripped('src/treeDragAndDrop.ts');

  it('每個被 set() 寫入的 MIME 都必須出現在 dragMimeTypes', () => {
    // 取得所有 `treeDataTransfer.set(<CONST>, ...)` 使用的常數
    const setTargets = [...source.matchAll(/treeDataTransfer\.set\(\s*([A-Z_][A-Z0-9_]*)/g)]
      .map((m) => m[1])
      .filter((name) => name !== 'INTERNAL_MIME'); // 內部 MIME 由 dragMimeTypes 首項承載

    expect(setTargets.length).toBeGreaterThan(0);

    const declMatch = source.match(/dragMimeTypes\s*=\s*\[([^\]]*)\]/);
    expect(declMatch, 'dragMimeTypes 宣告不存在').not.toBeNull();
    const declared = (declMatch as RegExpMatchArray)[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const missing = setTargets.filter((name) => !declared.includes(name));
    expect(missing, `以下 MIME 被 set() 但未列入 dragMimeTypes: ${missing.join(', ')}`).toEqual([]);
  });

  it('dragMimeTypes 明確包含 text/uri-list 與 application/vnd.code.uri-list', () => {
    const declMatch = source.match(/dragMimeTypes\s*=\s*\[([^\]]*)\]/);
    expect(declMatch).not.toBeNull();
    const declared = (declMatch as RegExpMatchArray)[1].split(',').map((s) => s.trim());
    expect(declared).toContain('URI_LIST_MIME');
    expect(declared).toContain('VND_URI_LIST_MIME');
  });

  it('多檔序列化使用 CRLF 分隔（VS Code uriList 以 CRLF 切分）', () => {
    expect(source.includes("join('\\r\\n')")).toBe(true);
  });
});

describe('TreeView 多選契約', () => {
  const source = readStripped('src/extension.ts');

  it('recentView 的 createTreeView 必須開啟 canSelectMany', () => {
    // 鎖定 recentView 的呼叫，避免其他 view 誤滿足
    const call = source.match(
      /createTreeView\(\s*['"]codeColorfulRecentFiles\.recentView['"][\s\S]*?\n\s*\}\)\s*;/
    );
    expect(call, 'recentView 的 createTreeView 呼叫不存在').not.toBeNull();
    expect(call![0]).toMatch(/canSelectMany\s*:\s*true/);
  });
});
