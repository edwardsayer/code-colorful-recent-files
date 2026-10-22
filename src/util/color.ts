/**
 * 色彩光譜運算與漸層內插工具函式 (純邏輯，可單元測試)
 */

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/** 將 HSL (h: 0-360, s: 0-1, l: 0-1) 轉換為 RGB (0-255) */
export function hslToRgb(h: number, s: number, l: number): RgbColor {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (h >= 0 && h < 60) {
    r1 = c;
    g1 = x;
    b1 = 0;
  } else if (h >= 60 && h < 120) {
    r1 = x;
    g1 = c;
    b1 = 0;
  } else if (h >= 120 && h < 180) {
    r1 = 0;
    g1 = c;
    b1 = x;
  } else if (h >= 180 && h < 240) {
    r1 = 0;
    g1 = x;
    b1 = c;
  } else if (h >= 240 && h < 300) {
    r1 = x;
    g1 = 0;
    b1 = c;
  } else if (h >= 300 && h < 360) {
    r1 = c;
    g1 = 0;
    b1 = x;
  }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

/** 將 RGB 轉為十六進位色碼 #RRGGBB */
export function rgbToHex(rgb: RgbColor): string {
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

/**
 * 彩虹圖譜漸層運算 (具備人眼感知亮度補償)：
 * t = 0.0 (最新) -> 紅 (Hue 0)
 * 過渡：紅 -> 橙 -> 黃 -> 綠 -> 青 -> 藍 -> 紫
 * t = 1.0 (最舊) -> 紫 (Hue 280)
 */
export function interpolateRainbow(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const hue = clamped * 280;

  // 人眼對藍光感知靈敏度較低，在藍紫光段 (180° ~ 280°) 動態提升明度，
  // 消除在深色主題背景下發暗的視覺落差
  let lightness = 0.52;
  if (hue >= 180) {
    const ratio = (hue - 180) / 100;
    lightness = 0.52 + ratio * 0.14;
  }

  const rgb = hslToRgb(hue, 0.85, lightness);
  return rgbToHex(rgb);
}

/**
 * 依順位比例取得明亮、高對比的 VS Code 內建 ThemeColor id。
 * 徹底解決部分主題中 charts.orange 偏向暗泥土色/暗棕色的問題，
 * 採用高明度的 gitDecoration.modifiedResourceForeground 與 terminal.ansiYellow，
 * 確保 #3, #4 與全光譜段在任何主題皆無比清晰亮麗。
 */
export function getSpectrumThemeColorId(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped < 0.17) return 'charts.red';
  if (clamped < 0.34) return 'gitDecoration.modifiedResourceForeground'; // 亮麗琥珀金橙，徹底取代暗泥土色的 charts.orange
  if (clamped < 0.51) return 'terminal.ansiYellow';                     // 鮮明亮金黃，確保不發暗
  if (clamped < 0.68) return 'charts.green';                           // 清爽翠綠
  if (clamped < 0.85) return 'terminal.ansiCyan';                       // 亮天藍
  return 'terminal.ansiMagenta';                                        // 亮粉紫
}

/**
 * 產生帶有指定顏色的圓點 SVG Data URI
 */
export function createColorDotSvgDataUri(colorHex: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="5" fill="${colorHex}" /></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
