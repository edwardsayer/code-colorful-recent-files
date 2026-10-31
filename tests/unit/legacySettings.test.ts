import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { decideLegacyGroupByMigration, isGroupByMode } from '../../src/util/settingsMigration';

/**
 * 舊設定移除契約（`feat.legacy-flag`，BACKLOG B-08）。
 *
 * 0.4.0 起 `codeColorfulRecentFiles.groupByDirectory` 不再宣告。移除宣告後，
 * 使用者 settings.json 裡的殘留值會被 VS Code 標成「未知設定」，而舊版**每次切換分組
 * 都會寫入這個鍵**，所以清理不是可有可無的收尾，而是移除動作的必要配套。
 */

const root = path.resolve(__dirname, '../..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

describe('manifest no longer declares the legacy flag', () => {
  it('has no groupByDirectory property', () => {
    const properties = pkg.contributes.configuration.properties as Record<string, unknown>;
    expect(properties['codeColorfulRecentFiles.groupByDirectory']).toBeUndefined();
  });

  it('has no leftover NLS description key', () => {
    for (const locale of ['package.nls.json', 'package.nls.zh-tw.json', 'package.nls.zh-cn.json']) {
      const nls = JSON.parse(readFileSync(path.join(root, locale), 'utf8'));
      expect(nls['configuration.groupByDirectory.description'], `${locale} 仍有殘留 key`).toBeUndefined();
    }
  });

  it('keeps groupBy as the single source of truth', () => {
    const properties = pkg.contributes.configuration.properties as Record<string, { enum?: string[] }>;
    expect(properties['codeColorfulRecentFiles.groupBy'].enum).toEqual(['none', 'directory', 'type']);
  });
});

describe('decideLegacyGroupByMigration', () => {
  it('does nothing when the legacy key is absent', () => {
    expect(decideLegacyGroupByMigration('type', undefined)).toEqual({ removeLegacy: false });
    expect(decideLegacyGroupByMigration(undefined, undefined)).toEqual({ removeLegacy: false });
  });

  it('requires the explicit value, not the manifest default', () => {
    // 呼叫端必須傳 `inspect().globalValue ?? …`，不可傳 `get('groupBy')`：
    // 後者會回 manifest 預設的 'none'，讓「只有舊旗標」的使用者被誤判成已設定。
    expect(decideLegacyGroupByMigration(undefined, true)).toEqual({ groupBy: 'directory', removeLegacy: true });
    expect(decideLegacyGroupByMigration('none', true)).toEqual({ removeLegacy: true });
  });

  it('removes a leftover key without touching an explicit groupBy', () => {
    expect(decideLegacyGroupByMigration('type', false)).toEqual({ removeLegacy: true });
    expect(decideLegacyGroupByMigration('none', true)).toEqual({ removeLegacy: true });
  });

  it('translates an intent that only exists in the legacy flag', () => {
    expect(decideLegacyGroupByMigration(undefined, true)).toEqual({ groupBy: 'directory', removeLegacy: true });
    // 非法的新值視同未設定
    expect(decideLegacyGroupByMigration('bogus', true)).toEqual({ groupBy: 'directory', removeLegacy: true });
  });

  it('removes the key when the legacy flag is false and groupBy is unset', () => {
    expect(decideLegacyGroupByMigration(undefined, false)).toEqual({ removeLegacy: true });
  });

  it('recognises the three legal modes', () => {
    for (const mode of ['none', 'directory', 'type']) {
      expect(isGroupByMode(mode)).toBe(true);
    }
    for (const bad of [undefined, null, '', 'dir', 0, true]) {
      expect(isGroupByMode(bad)).toBe(false);
    }
  });
});
