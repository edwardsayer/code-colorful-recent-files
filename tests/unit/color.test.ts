import { describe, expect, it } from 'vitest';
import {
  PALETTE_2026_DARK,
  PALETTE_2026_LIGHT,
  createColorDotSvgDataUri,
  getSpectrumThemeColorId,
  hexToRgb,
  interpolatePalette,
  interpolateRainbow,
  rgbToHex,
} from '../../src/util/color';

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
    expect(getSpectrumThemeColorId(0.05)).toBe('charts.red');
    expect(getSpectrumThemeColorId(0.25)).toBe('charts.orange');
    expect(getSpectrumThemeColorId(0.40)).toBe('charts.yellow');
    expect(getSpectrumThemeColorId(0.60)).toBe('charts.green');
    expect(getSpectrumThemeColorId(0.75)).toBe('charts.blue');
    expect(getSpectrumThemeColorId(0.95)).toBe('charts.purple');
  });

  it('creates svg data uri with the specified color', () => {
    const uri = createColorDotSvgDataUri('#ff0000');
    expect(uri).toContain('data:image/svg+xml;utf8,');
    expect(uri).toContain('%23ff0000');
  });
});
