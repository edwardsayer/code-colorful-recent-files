import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 檔案操作命令的 manifest 契約。
 *
 * 這裡守的是「宣告與實作一致」與「安全閘門不可漏」：
 * - 四個命令都必須有 manifest 條目、handler、三語標題
 * - 三個選單項必須帶 `isWorkspaceTrusted`（少了就是 UI 層直接放行）
 * - `undoFileOperation` 沒有節點也能執行，所以不能有 `viewItem` 條件
 * - 每個寫入 handler 進入點都必須呼叫 `requireTrust()`（feat/R5 移交的檢查）
 */

const root = path.resolve(__dirname, '../..');
const readJson = (rel: string) => JSON.parse(readFileSync(path.join(root, rel), 'utf8'));
const readText = (rel: string) => readFileSync(path.join(root, rel), 'utf8');

const pkg = readJson('package.json');
const operations = readText('src/fileOperations.ts');
const PREFIX = 'codeColorfulRecentFiles.';

const COMMANDS = ['renameEntry', 'moveTo', 'deleteEntry', 'undoFileOperation'];
const WRITE_COMMANDS = ['renameEntry', 'moveTo', 'deleteEntry'];

describe('file operation commands', () => {
  it('contributes every command with a localized title', () => {
    const contributed = new Map(pkg.contributes.commands.map((c: { command: string; title: string }) => [c.command, c.title]));
    for (const id of COMMANDS) {
      const title = contributed.get(PREFIX + id) as string | undefined;
      expect(title, `${id} 未貢獻`).toBeDefined();
      expect(title, `${id} 標題應走 nls key`).toMatch(/^%.+%$/);
    }
  });

  it('registers a handler for every command', () => {
    for (const id of COMMANDS) {
      // 原始碼以 template literal 組 id（`${PREFIX}renameEntry`），不是字面字串
      expect(operations, `${id} 缺少 registerCommand`).toContain(`registerCommand(\`\${PREFIX}${id}\``);
    }
  });

  it('has a title key in all three nls catalogs', () => {
    const keys = COMMANDS.map((id) => `command.${id}.title`);
    for (const file of ['package.nls.json', 'package.nls.zh-tw.json', 'package.nls.zh-cn.json']) {
      const nls = readJson(file);
      for (const key of keys) {
        expect(nls[key], `${file} 缺少 ${key}`).toBeTruthy();
      }
    }
  });
});

describe('view/item/context entries', () => {
  const items: Array<{ command: string; when: string; group: string }> = pkg.contributes.menus['view/item/context'];

  it('shows the three modifying commands only for file items and only when trusted', () => {
    for (const id of WRITE_COMMANDS) {
      const entry = items.find((i) => i.command === PREFIX + id);
      expect(entry, `${id} 未在選單中`).toBeDefined();
      expect(entry!.when, `${id} 缺少 isWorkspaceTrusted`).toContain('isWorkspaceTrusted');
      expect(entry!.when, `${id} 應限制在 fileItem`).toContain('viewItem =~ /^fileItem/');
    }
  });

  it('keeps undo available without a node but still gated by trust', () => {
    const entry = items.find((i) => i.command === PREFIX + 'undoFileOperation');
    expect(entry).toBeDefined();
    expect(entry!.when).toContain('isWorkspaceTrusted');
    // undo 是無節點操作；若加了 viewItem 條件，未選取時就永遠無法復原
    expect(entry!.when, 'undo 不應有 viewItem 條件').not.toContain('viewItem');
  });

  it('does not offer modifying commands for type groups (no filesystem path)', () => {
    // typeItem 的 contextValue 是 'typeItem' / 'typeItem.pinned'，不匹配 /^fileItem/
    for (const id of WRITE_COMMANDS) {
      const entry = items.find((i) => i.command === PREFIX + id);
      expect(entry!.when).not.toMatch(/typeItem/);
    }
  });
});

describe('workspace trust gate', () => {
  it('every writing handler starts with requireTrust()', () => {
    // feat/R5 移交：manifest 的 when 只是 UI 層，handler 必須自行檢查。
    // 以「函式定義後第一個陳述式」的位置檢查，避免把任何位置出現 requireTrust 都算通過。
    for (const name of WRITE_COMMANDS) {
      const pattern = new RegExp(`const ${name} = async \\([^)]*\\)[^{]*\\{\\s*if \\(!requireTrust\\(\\)\\) return;`);
      expect(operations, `${name} 進入點缺少 requireTrust()`).toMatch(pattern);
    }
    const undo = /const undoFileOperation = async \([^)]*\)[^{]*\{\s*if \(!requireTrust\(\)\) return;/;
    expect(operations, 'undoFileOperation 進入點缺少 requireTrust()').toMatch(undo);
  });

  it('refuses to delete on non-file providers when trash is enabled', () => {
    // 沒有通用 trash capability API；provider 可能忽略 useTrash 而靜默永久刪除
    expect(operations).toContain("useTrash && source.scheme !== 'file'");
  });

  it('never overwrites an existing target', () => {
    // 所有 rename 呼叫都必須帶 overwrite: false
    const renames = operations.match(/workspace\.fs\.rename\([^)]*\)/g) ?? [];
    expect(renames.length).toBeGreaterThan(0);
    for (const call of renames) {
      expect(call, `rename 未禁止覆寫：${call}`).toContain('overwrite: false');
    }
  });
});

describe('selection context key for keybindings', () => {
  it('publishes selectedKind because viewItem is unusable in keybindings', () => {
    // 實機證實 viewItem 在 keybinding when 中恆為 false（tests/feat/R3/）
    expect(operations).toContain('selectedKind');
    expect(operations).toContain('onDidChangeSelection');
  });
});
describe('keybindings (feat.file-ops-shortcuts)', () => {
  interface Binding {
    command: string;
    key: string;
    mac?: string;
    when?: string;
    args?: unknown;
  }
  const bindings: Binding[] = pkg.contributes.keybindings ?? [];
  const SPEC = 'dev/code-colorful-recent-files/specs/file-operations-design.md §8';
  const GATE = ['focusedView == codeColorfulRecentFiles.recentView', 'listFocus', 'isWorkspaceTrusted'];

  it('declares exactly the three contracted shortcuts', () => {
    const actual = bindings.map((b) => `${b.key} -> ${b.command}`).sort();
    expect(actual, `快捷鍵契約不符（${SPEC}）`).toEqual([
      `ctrl+z -> ${PREFIX}undoFileOperation`,
      `delete -> ${PREFIX}deleteEntry`,
      `f2 -> ${PREFIX}renameEntry`,
    ]);
  });

  it('gates every shortcut behind focus, list focus and trust', () => {
    for (const binding of bindings) {
      for (const gate of GATE) {
        expect(binding.when ?? '', `${binding.key} 缺少 ${gate}`).toContain(gate);
      }
    }
  });

  it('requires a selected file node for the two node-bound shortcuts', () => {
    for (const key of ['f2', 'delete']) {
      const binding = bindings.find((b) => b.key === key);
      expect(binding!.when, `${key} 應限定選取檔案節點`).toContain('codeColorfulRecentFiles.selectedKind == file');
    }
    // undo 是無節點操作：若限定選取，未選取時就永遠無法復原
    const undo = bindings.find((b) => b.key === 'ctrl+z');
    expect(undo!.when, 'undo 不應限定選取節點').not.toContain('selectedKind');
  });

  it('passes no args because handlers read treeView.selection', () => {
    for (const binding of bindings) {
      expect(binding.args, `${binding.key} 不應在 keybinding 傳 args`).toBeUndefined();
    }
  });

  it('binds the undo shortcut to the platform-native redo-free key', () => {
    // macOS 的 "ctrl+z" 不是使用者預期的 undo 鍵，必須宣告 cmd+z（spec §8）。
    const undo = bindings.find((b) => b.key === 'ctrl+z');
    expect(undo!.mac, 'ctrl+z 缺少 mac 變體 cmd+z').toBe('cmd+z');
    // F2／Delete 是跨平台同鍵，不需 mac 變體
    for (const key of ['f2', 'delete']) {
      expect(bindings.find((b) => b.key === key)!.mac, `${key} 不應有 mac 變體`).toBeUndefined();
    }
  });

  it('has no keybinding that relies on viewItem', () => {
    // 實機證實 viewItem 在 keybinding when 中恆為 false（tests/feat/R3/）
    for (const binding of bindings) {
      expect(binding.when ?? '', `keybinding 不可使用 viewItem：${binding.command}`).not.toContain('viewItem');
    }
  });
});

describe('history consistency wiring', () => {
  it('rewrites history and pinned order after a successful operation', () => {
    const manager = readText('src/recentFilesManager.ts');
    expect(manager).toContain('applyPathRewrite');
    expect(manager).toContain('applyPathRemoval');
    // 三處都要同步：records、openTabsSet、pinnedGroupOrder
    expect(manager).toContain('rewriteRecordPaths');
    expect(manager).toContain('rewritePinnedDirKeys');
    expect(manager).toContain('rekeyPathSet');
    expect(manager).toContain('removePinnedDirKeys');
  });
});
