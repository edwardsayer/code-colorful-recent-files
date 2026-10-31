import { beforeEach, describe, expect, it } from 'vitest';
import {
  FALLBACK_COLOR_IDS,
  HEAT_COLOR_IDS,
  PALETTE_2026_DARK,
  PALETTE_2026_LIGHT,
  createColorDotSvgDataUri,
  decideHeatTokensReady,
  getHeatColorId,
  getSpectrumThemeColorId,
  hexToRgb,
  interpolatePalette,
  interpolateRainbow,
  isTransparentColor,
  rgbToHex,
  resetHeatTokensReady,
  setHeatTokensReady,
} from '../../src/util/color';

beforeEach(() => {
  resetHeatTokensReady();
});

describe('color utility', () => {
  it('converts hex to RGB accurately', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
    expect(hexToRgb('0000ff')).toEqual({ r: 0, g: 0, b: 255 });
    expect(hexToRgb('#ef8773')).toEqual({ r: 239, g: 135, b: 115 });
  });

  it('generates hex strings correctly', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#ff0000');
    expect(rgbToHex({ r: 0, g: 255, b: 0 })).toBe('#00ff00');
    expect(rgbToHex({ r: 15, g: 15, b: 15 })).toBe('#0f0f0f');
  });

  it('interpolates palette smoothly from start to end', () => {
    expect(interpolatePalette(PALETTE_2026_DARK, 0)).toBe(PALETTE_2026_DARK[0].toLowerCase());
    expect(interpolatePalette(PALETTE_2026_DARK, 1)).toBe(PALETTE_2026_DARK[PALETTE_2026_DARK.length - 1].toLowerCase());

    expect(interpolatePalette(PALETTE_2026_LIGHT, 0)).toBe(PALETTE_2026_LIGHT[0].toLowerCase());
    expect(interpolatePalette(PALETTE_2026_LIGHT, 1)).toBe(PALETTE_2026_LIGHT[PALETTE_2026_LIGHT.length - 1].toLowerCase());

    // 驗證輸入超過邊界時 clamp
    expect(interpolatePalette(PALETTE_2026_DARK, -0.5)).toBe(PALETTE_2026_DARK[0].toLowerCase());
    expect(interpolatePalette(PALETTE_2026_DARK, 1.5)).toBe(PALETTE_2026_DARK[PALETTE_2026_DARK.length - 1].toLowerCase());
  });

  it('interpolates rainbow spectrum for both dark and light palettes', () => {
    // 深色模式 (2026 Dark: 珊瑚粉紅 -> 薰衣草紫)
    const darkStart = interpolateRainbow(0, false);
    const darkEnd = interpolateRainbow(1, false);
    expect(darkStart).toBe('#ef8773');
    expect(darkEnd).toBe('#ad80d7');

    // 亮色模式 (2026 Light: 沉穩酒紅 -> 葡萄濃紫)
    const lightStart = interpolateRainbow(0, true);
    const lightEnd = interpolateRainbow(1, true);
    expect(lightStart).toBe('#ad0707');
    expect(lightEnd).toBe('#652d90');
  });

  it('maps rank ratio to ThemeColor ids with charts spectrum', () => {
    expect(getSpectrumThemeColorId(0.05)).toBe('colorfulRecentFiles.heat1');
    expect(getSpectrumThemeColorId(0.25)).toBe('colorfulRecentFiles.heat2');
    expect(getSpectrumThemeColorId(0.40)).toBe('colorfulRecentFiles.heat3');
    expect(getSpectrumThemeColorId(0.60)).toBe('colorfulRecentFiles.heat4');
    expect(getSpectrumThemeColorId(0.75)).toBe('colorfulRecentFiles.heat5');
    expect(getSpectrumThemeColorId(0.95)).toBe('colorfulRecentFiles.heat6');
  });

  it('creates svg data uri with the specified color', () => {
    const uri = createColorDotSvgDataUri('#ff0000');
    expect(uri).toContain('data:image/svg+xml;utf8,');
    expect(uri).toContain('%23ff0000');
  });
});

describe('first-session fallback colors', () => {
  it('never uses charts.orange (semi-transparent in VSCodium / Code-OSS)', () => {
    // 回歸保護：VSCodium 的 charts.orange 是 rgba(234, 92, 0, 0.33)，
    // 當成文字前景色會幾乎看不見，因此橘色階必須使用不透明的替代 token。
    expect(FALLBACK_COLOR_IDS).not.toContain('charts.orange');
    expect(FALLBACK_COLOR_IDS).toHaveLength(HEAT_COLOR_IDS.length);
  });

  it('maps the orange step to an opaque built-in token', () => {
    expect(FALLBACK_COLOR_IDS[1]).toBe('symbolIcon.classForeground');
  });

  it('switches between heat and fallback tokens via setHeatTokensReady', () => {
    setHeatTokensReady(true);
    expect(getHeatColorId(1)).toBe('colorfulRecentFiles.heat2');
    expect(getSpectrumThemeColorId(0.25)).toBe('colorfulRecentFiles.heat2');

    setHeatTokensReady(false);
    expect(getHeatColorId(1)).toBe('symbolIcon.classForeground');
    expect(getSpectrumThemeColorId(0.25)).toBe('symbolIcon.classForeground');

    setHeatTokensReady(true); // 還原，避免影響其他測試
  });

  it('clamps out-of-range heat levels instead of returning undefined', () => {
    // feat.defensive-bounds／B-01：超出級距或非有限值過去會回傳 undefined，
    // 讓 `new vscode.ThemeColor(undefined)` 在執行期炸掉。
    setHeatTokensReady(true);
    expect(getHeatColorId(0)).toBe(HEAT_COLOR_IDS[0]);
    expect(getHeatColorId(-3)).toBe(HEAT_COLOR_IDS[0]);
    expect(getHeatColorId(Number.NaN)).toBe(HEAT_COLOR_IDS[0]);
    expect(getHeatColorId(Number.POSITIVE_INFINITY)).toBe(HEAT_COLOR_IDS[0]);
    expect(getHeatColorId(HEAT_COLOR_IDS.length + 10)).toBe(HEAT_COLOR_IDS[HEAT_COLOR_IDS.length - 1]);
    expect(getHeatColorId(2.7)).toBe(HEAT_COLOR_IDS[2]);
  });

  it('detects semi-transparent color values', () => {
    expect(isTransparentColor('rgba(234, 92, 0, 0.33)')).toBe(true);
    expect(isTransparentColor('rgba(234, 92, 0, 1)')).toBe(false);
    expect(isTransparentColor('#ff00ff')).toBe(false);
    expect(isTransparentColor('#ff00ff80')).toBe(true);
    expect(isTransparentColor('#ff00ffff')).toBe(false);
    expect(isTransparentColor('transparent')).toBe(true);
    expect(isTransparentColor('')).toBe(true);
  });
});

describe('decideHeatTokensReady (first-session token detection)', () => {
  const HOST = 1_792_854_000_000; // 假設 Extension Host 啟動時間

  it('treats an extension installed before this window as ready', () => {
    // 安裝於上一次工作階段（例如一般啟動）→ token 已由視窗啟動時套用
    expect(decideHeatTokensReady(HOST - 86_400_000, HOST)).toBe(true);
  });

  it('treats an extension installed after this window as NOT ready (runtime install)', () => {
    // 使用者的「移除 → reload → 從 VSIX 重裝」流程：安裝時間晚於本視窗啟動
    expect(decideHeatTokensReady(HOST + 60_000, HOST)).toBe(false);
    expect(decideHeatTokensReady(HOST + 3_600_000, HOST)).toBe(false);
  });

  it('treats an install within the default 30s tolerance as NOT ready', () => {
    // 檔案時間與程序啟動時間有顆粒度，落在容差內一律視為未就緒（偏向 fallback）
    expect(decideHeatTokensReady(HOST - 1_000, HOST)).toBe(false);
    expect(decideHeatTokensReady(HOST - 29_999, HOST)).toBe(false);
    expect(decideHeatTokensReady(HOST - 30_001, HOST)).toBe(true);
  });

  it('covers the exact epsilon boundary as ready', () => {
    // installedAt === hostStart - epsilon → <= 成立 → ready
    expect(decideHeatTokensReady(HOST - 30_000, HOST)).toBe(true);
    expect(decideHeatTokensReady(HOST - 5_000, HOST, 5_000)).toBe(true);
    expect(decideHeatTokensReady(HOST - 4_999, HOST, 5_000)).toBe(false);
  });

  it('honours a custom epsilon', () => {
    expect(decideHeatTokensReady(HOST - 20_000, HOST, 60_000)).toBe(false);
    expect(decideHeatTokensReady(HOST - 20_000, HOST, 10_000)).toBe(true);
  });

  it('covers the late Extension Host restart case', () => {
    // 安裝後 20 秒才發生 EH 重啟（視窗未 reload）→ hostStart 往後移，
    // 30 秒容差仍能判定為未就緒，避免重現不上色。
    const restartHost = HOST + 20_000;
    expect(decideHeatTokensReady(HOST, restartHost)).toBe(false);
  });

  it('falls back when timestamps are unavailable', () => {
    expect(decideHeatTokensReady(0, HOST)).toBe(false);
    expect(decideHeatTokensReady(HOST - 86_400_000, 0)).toBe(false);
    expect(decideHeatTokensReady(NaN, HOST)).toBe(false);
    expect(decideHeatTokensReady(HOST, NaN)).toBe(false);
  });
});
