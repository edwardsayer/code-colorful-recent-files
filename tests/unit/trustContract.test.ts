import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Workspace Trust 宣告契約。
 *
 * 為什麼需要這支測試：`capabilities.untrustedWorkspaces` 是對使用者的**行為承諾**。
 * 加入寫磁碟能力後若忘記改宣告，描述就會變成謊言，而 `npm run check` 不會有任何反應。
 * 這裡把「宣告必須與能力相符」變成可執行的檢查，防止回歸。
 *
 * 對應 `feat.file-ops-trust` FOT-01 與 spec `file-operations-design.md` §5。
 */

const root = path.resolve(__dirname, '../..');
const readJson = (rel: string) => JSON.parse(readFileSync(path.join(root, rel), 'utf8'));

const pkg = readJson('package.json');
const locales = ['package.nls.json', 'package.nls.zh-tw.json', 'package.nls.zh-cn.json'];
const DESCRIPTION_KEY = 'capabilities.untrustedWorkspaces.description';

describe('untrustedWorkspaces declaration', () => {
  it('is "limited" because the extension can modify files', () => {
    // 一旦 file-ops 系列上線，`true` 就是錯的宣告；`false` 也不對（讀取與顯示仍可用）。
    expect(pkg.capabilities?.untrustedWorkspaces?.supported).toBe('limited');
  });

  it('references the description through an nls key', () => {
    expect(pkg.capabilities?.untrustedWorkspaces?.description).toBe(`%${DESCRIPTION_KEY}%`);
  });

  it('no longer claims the extension never writes to disk', () => {
    // 舊描述 "Works locally without modifying disk..." 在加入寫入能力後即不誠實。
    const forbidden = [/without modifying disk/i, /不寫入不受信任磁碟/, /不向不受信任的磁盘写入/];
    for (const file of locales) {
      const value = readJson(file)[DESCRIPTION_KEY] as string;
      for (const pattern of forbidden) {
        expect(value, `${file} 仍宣稱不寫入磁碟`).not.toMatch(pattern);
      }
    }
  });

  it('states that modifying commands require trust, in every locale', () => {
    const expectations: Record<string, RegExp> = {
      'package.nls.json': /untrusted workspaces/i,
      'package.nls.zh-tw.json': /不受信任/,
      'package.nls.zh-cn.json': /不受信任/,
    };
    for (const [file, pattern] of Object.entries(expectations)) {
      const value = readJson(file)[DESCRIPTION_KEY] as string;
      expect(value, `${file} 描述缺少受信任條件`).toMatch(pattern);
      // 必須提到至少一項會被停用的寫入能力，避免寫成空泛的「部分功能受限」
      expect(value, `${file} 未說明哪些命令被停用`).toMatch(/rename|重新命名|重命名/);
    }
  });

  it('keeps virtualWorkspaces unsupported (virtual FS cannot be written anyway)', () => {
    expect(pkg.capabilities?.virtualWorkspaces?.supported).toBe(false);
  });
});

describe('trust gate plumbing', () => {
  it('has a localized message for the untrusted rejection in all bundles', () => {
    const message = 'Trust the workspace before modifying files.';
    for (const file of ['l10n/bundle.l10n.json', 'l10n/bundle.l10n.zh-tw.json', 'l10n/bundle.l10n.zh-cn.json']) {
      const bundle = readJson(file);
      expect(bundle[message], `${file} 缺少拒絕訊息`).toBeTruthy();
      expect(String(bundle[message]).trim().length).toBeGreaterThan(0);
    }
  });

  it('exports requireTrust from a module that does not depend on fileOps internals', async () => {
    // trust.ts 需要 vscode，無法在單元測試環境直接載入；改為檢查原始碼契約：
    // 必須使用 workspace.isTrusted 並經 canModifyFiles 決策，且走 l10n。
    const source = readFileSync(path.join(root, 'src/util/trust.ts'), 'utf8');
    expect(source).toMatch(/workspace\.isTrusted/);
    expect(source).toMatch(/canModifyFiles/);
    expect(source).toMatch(/l10n\.t\(/);
    expect(source).toMatch(/export function requireTrust/);
  });
});
