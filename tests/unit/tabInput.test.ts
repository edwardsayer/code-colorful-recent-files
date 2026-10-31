import { describe, expect, it } from 'vitest';
import { isOpaqueTabInput, readTabInputPath } from '../../src/util/tabInput';

/**
 * `Tab.input` 解析契約（`feat.custom-editor-tracking`，BACKLOG B-12）。
 *
 * 背景：VS Code 1.144.0 對 custom editor 分頁送來的 `tab.input` 是 **`undefined`**，
 * 同一份程式在 VSCodium 1.140.0 收到的是 `{ uri, viewType }`。這裡把三種真實形狀
 * 與幾種壞形狀固定下來，避免再次退回「靜默不追蹤」。
 */

const uri = (scheme: string, fsPath: string) => ({ scheme, fsPath, toString: () => `${scheme}://${fsPath}` });

describe('readTabInputPath', () => {
  it('reads TabInputText / TabInputCustom shape (uri)', () => {
    expect(readTabInputPath({ uri: uri('file', '/a.txt') })).toEqual({ scheme: 'file', fsPath: '/a.txt' });
  });

  it('reads TabInputTextDiff shape (resource)', () => {
    expect(readTabInputPath({ resource: uri('file', '/b.txt') })).toEqual({ scheme: 'file', fsPath: '/b.txt' });
  });

  it('prefers uri over resource when both exist', () => {
    expect(readTabInputPath({ uri: uri('file', '/one'), resource: uri('file', '/two') })).toEqual({
      scheme: 'file',
      fsPath: '/one',
    });
  });

  it('returns undefined for the input shape VS Code 1.144 sends (no input at all)', () => {
    // 實機觀測：`tab.input === undefined`。注意 `Object.isFrozen(undefined) === true`，
    // 早期誤把這個回傳值當成「凍結的空物件」，判定因此走錯分支。
    expect(readTabInputPath(undefined)).toBeUndefined();
    expect(readTabInputPath(Object.freeze({}))).toBeUndefined();
  });

  it('returns undefined for webview input, which only has viewType', () => {
    expect(readTabInputPath({ viewType: 'mainThreadWebview-markdown.preview' })).toBeUndefined();
  });

  it('rejects uri-likes without usable scheme/fsPath', () => {
    expect(readTabInputPath({ uri: 'file:///a.txt' })).toBeUndefined();
    expect(readTabInputPath({ uri: { scheme: 'file' } })).toBeUndefined();
    expect(readTabInputPath({ uri: { scheme: '', fsPath: '/a' } })).toBeUndefined();
    expect(readTabInputPath({ uri: { scheme: 'file', fsPath: '' } })).toBeUndefined();
  });

  it('returns undefined for nullish input', () => {
    expect(readTabInputPath(undefined)).toBeUndefined();
    expect(readTabInputPath(null)).toBeUndefined();
  });
});

describe('isOpaqueTabInput', () => {
  it('flags missing and empty inputs as opaque', () => {
    expect(isOpaqueTabInput(undefined)).toBe(true);
    expect(isOpaqueTabInput(Object.freeze({}))).toBe(true);
  });

  it('does not flag inputs that carry fields', () => {
    expect(isOpaqueTabInput({ uri: uri('file', '/a.txt') })).toBe(false);
    // webview 沒有 uri 但有 viewType，屬「已知不支援」而非「被剝離」
    expect(isOpaqueTabInput({ viewType: 'mainThreadWebview-markdown.preview' })).toBe(false);
  });
});
