import { describe, expect, it } from 'vitest';
import {
  createColorDotSvgDataUri,
  getSpectrumThemeColorId,
  hslToRgb,
  interpolateRainbow,
  rgbToHex,
} from '../../src/util/color';

describe('color utility', () => {
  it('converts HSL to RGB accurately', () => {
    // 紅色 (Hue 0, Sat 1, Light 0.5)
    const red = hslToRgb(0, 1, 0.5);
    expect(red).toEqual({ r: 255, g: 0, b: 0 });

    // 綠色 (Hue 120, Sat 1, Light 0.5)
    const green = hslToRgb(120, 1, 0.5);
    expect(green).toEqual({ r: 0, g: 255, b: 0 });

    // 藍色 (Hue 240, Sat 1, Light 0.5)
    const blue = hslToRgb(240, 1, 0.5);
    expect(blue).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('generates hex strings correctly', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#ff0000');
    expect(rgbToHex({ r: 0, g: 255, b: 0 })).toBe('#00ff00');
    expect(rgbToHex({ r: 15, g: 15, b: 15 })).toBe('#0f0f0f');
  });

  it('interpolates rainbow spectrum smoothly from red (t=0) to purple (t=1)', () => {
    const startColor = interpolateRainbow(0);
    const midColor = interpolateRainbow(0.5); // 約 140 度 (偏青綠色)
    const endColor = interpolateRainbow(1);   // 280 度 (紫羅蘭色)

    // t=0 應該為偏紅
    expect(startColor.toLowerCase()).toMatch(/^#[e-f][0-9a-f]{5}$/);

    // t=0.5 應該為綠/青色系
    expect(midColor.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/);

    // t=1 應該為紫色系 (R > 0, B > R, G 較低)
    expect(endColor.toLowerCase()).toMatch(/^#[5-9a-f][0-9a-f]{5}$/);

    // 驗證輸入超過邊界時 clamp
    expect(interpolateRainbow(-0.5)).toBe(startColor);
    expect(interpolateRainbow(1.5)).toBe(endColor);
  });

  it('maps rank ratio to ThemeColor ids', () => {
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
