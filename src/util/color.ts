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
 * 彩虹圖譜漸層運算：
 * t = 0.0 (最新) -> 紅 (Hue 0)
 * 過渡：紅 -> 橙 -> 黃 -> 綠 -> 藍 -> 靛 -> 紫
 * t = 1.0 (最舊) -> 紫 (Hue 280)
 */
export function interpolateRainbow(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  // Hue 從 0 度 (紅) 平滑過渡到 280 度 (紫)
  const hue = clamped * 280;
  const rgb = hslToRgb(hue, 0.88, 0.52);
  return rgbToHex(rgb);
}

/**
 * 依順位比例取得最接近的 VS Code 內建 ThemeColor id
 * 供 FileDecorationProvider 使用 (VS Code 限制 color 必須為 ThemeColor)
 */
export function getSpectrumThemeColorId(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped < 0.17) return 'charts.red';
  if (clamped < 0.34) return 'charts.orange';
  if (clamped < 0.51) return 'charts.yellow';
  if (clamped < 0.68) return 'charts.green';
  if (clamped < 0.85) return 'charts.blue';
  return 'charts.purple';
}

/**
 * 產生帶有指定顏色的圓點 SVG Data URI
 * 在 TreeView 中以平滑無階梯的自訂漸變色彩呈現圖示
 */
export function createColorDotSvgDataUri(colorHex: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="5" fill="${colorHex}" /></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
