import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `openFile` 焦點契約（`feat.row-focus`）。
 *
 * 為什麼需要這支測試：清單的單擊行為是**一行旗標**決定的——`vscode.open` 若不帶
 * `preserveFocus`，點列後焦點立刻被編輯器搶走，`listFocus` 變 false，於是
 * `F2`／`Delete`（`when` 需要 `listFocus`）在剛點完列的直覺動線上完全失效。
 * 這個回歸不會被型別或既有單元測試抓到，只有實機按鍵才會發現，因此用原始碼契約守住。
 *
 * 對應 stage `feat.row-focus`（BACKLOG B-10）與 `tests/feat/R7/` 的「點列搶焦點」發現。
 */

const root = path.resolve(__dirname, '../..');
const source = readFileSync(path.join(root, 'src/extension.ts'), 'utf8');

describe('openFile keeps the list focused', () => {
  it('passes preserveFocus and preview to vscode.open', () => {
    // 只檢查 openFile 這一段，避免其他地方的 showTextDocument／open 呼叫造成誤判。
    const start = source.indexOf("registerCommand('codeColorfulRecentFiles.openFile'");
    expect(start, '找不到 openFile 指令註冊').toBeGreaterThan(-1);
    const block = source.slice(start, source.indexOf('});', start));

    expect(block, 'openFile 必須保留焦點，否則點列後 F2／Delete 失效').toMatch(/preserveFocus:\s*true/);
    expect(block, '單擊列應像原生 Explorer 一樣開在預覽分頁').toMatch(/preview:\s*true/);
  });

  it('does not call vscode.open without show options', () => {
    const start = source.indexOf("registerCommand('codeColorfulRecentFiles.openFile'");
    const block = source.slice(start, source.indexOf('});', start));
    // `executeCommand('vscode.open', uri)` 這種單參數呼叫就是回歸的樣貌
    expect(block).not.toMatch(/executeCommand\(\s*'vscode\.open'\s*,\s*uri\s*\)/);
  });
});
