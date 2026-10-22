/**
 * 色彩光譜運算與漸層內插工具函式 (純邏輯，可單元測試)
 */

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/** 2026 Dark 官方舒適色票 (深色底) */
export const PALETTE_2026_DARK = [
  '#EF8773', // charts.red (珊瑚粉紅)
  '#CD861A', // charts.orange (焦糖琥珀橙)
  '#E0B97F', // charts.yellow (香檳金黃)
  '#86CF86', // charts.green (薄荷翠綠)
  '#57A3F8', // charts.blue (天青湛藍)
  '#AD80D7', // charts.purple (薰衣草紫)
] as const;

/** 2026 Light 官方舒適色票 (亮色底高對比) */
export const PALETTE_2026_LIGHT = [
  '#AD0707', // charts.red (沉穩寶石紅)
  '#D18616', // charts.orange (深焦糖橙)
  '#667309', // charts.yellow (橄欖深金黃，防反光隱形)
  '#388A34', // charts.green (深森林翠綠)
  '#1A5CFF', // charts.blue (皇室蔚藍)
  '#652D90', // charts.purple (深葡萄濃紫)
] as const;

/** 十六進位色碼轉 RGB */
export function hexToRgb(hex: string): RgbColor {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex;
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/** 將 RGB 轉為十六進位色碼 #RRGGBB */
export function rgbToHex(rgb: RgbColor): string {
  const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * 對給定色票進行多點平滑線性插值 (Piecewise Linear Interpolation)
 * t: 0.0 (首色) ~ 1.0 (末色)
 */
export function interpolatePalette(palette: readonly string[], t: number): string {
  if (palette.length === 0) return '#000000';
  if (palette.length === 1) return palette[0];

  const clamped = Math.max(0, Math.min(1, t));
  const segment = (palette.length - 1) * clamped;
  const index = Math.min(palette.length - 2, Math.floor(segment));
  const factor = segment - index;

  const c1 = hexToRgb(palette[index]);
  const c2 = hexToRgb(palette[index + 1]);

  return rgbToHex({
    r: c1.r + (c2.r - c1.r) * factor,
    g: c1.g + (c2.g - c1.g) * factor,
    b: c1.b + (c2.b - c1.b) * factor,
  });
}

/**
 * 彩虹圖譜漸層運算：
 * 支援深色模式 (2026 Dark) 與亮色模式 (2026 Light) 自適應色票
 * t = 0.0 (最新) -> 紅
 * t = 1.0 (最舊) -> 紫
 */
export function interpolateRainbow(t: number, isLight = false): string {
  const palette = isLight ? PALETTE_2026_LIGHT : PALETTE_2026_DARK;
  return interpolatePalette(palette, t);
}

/**
 * 依順位比例取得 VS Code ThemeColor id
 * 使用套件專屬的 colorfulRecentFiles.heat1 ~ heat6 (在 package.json 預設對齊 charts.* 系列)
 */
export function getSpectrumThemeColorId(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped < 0.17) return 'colorfulRecentFiles.heat1';
  if (clamped < 0.34) return 'colorfulRecentFiles.heat2';
  if (clamped < 0.51) return 'colorfulRecentFiles.heat3';
  if (clamped < 0.68) return 'colorfulRecentFiles.heat4';
  if (clamped < 0.85) return 'colorfulRecentFiles.heat5';
  return 'colorfulRecentFiles.heat6';
}

/**
 * 產生帶有指定顏色的圓點 SVG Data URI
 */
export function createColorDotSvgDataUri(colorHex: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="5" fill="${colorHex}" /></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
