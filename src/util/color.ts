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
 * 本擴充套件貢獻的熱度色彩 token（由新到舊）。
 * 預設值為與主題無關的固定色票（見 package.json contributes.colors），使用者可用 workbench.colorCustomizations 覆寫。
 */
export const HEAT_COLOR_IDS = [
  'colorfulRecentFiles.heat1',
  'colorfulRecentFiles.heat2',
  'colorfulRecentFiles.heat3',
  'colorfulRecentFiles.heat4',
  'colorfulRecentFiles.heat5',
  'colorfulRecentFiles.heat6',
] as const;

/**
 * 內建色彩 token（由新到舊，與 heat1~6 一一對應）。
 * VS Code 不會在執行期安裝擴充套件後立即套用其新貢獻的色彩 token（需重載或切換 Color Theme），
 * 該情況下暫時以這組 VS Code 內建 token 上色，確保首次安裝即有色彩。
 *
 * ⚠️ 不能用 `charts.orange`：VSCodium（及 Code-OSS 系）將其定義為
 * `rgba(234, 92, 0, 0.33)`（33% 不透明度，設計給圖表填色），當成文字前景色時幾乎看不見。
 * 因此橘色階改用跨發行版都不透明的 `symbolIcon.classForeground`（橘色系，深／淺色主題皆不透明）。
 * 其餘 `charts.*` 在 VS Code 與 VSCodium 皆為不透明，可安全使用。
 */
export const FALLBACK_COLOR_IDS = [
  'charts.red',
  'symbolIcon.classForeground',
  'charts.yellow',
  'charts.green',
  'charts.blue',
  'charts.purple',
] as const;

let heatTokensReady = true;

/**
 * 判斷本擴充套件貢獻的 heat token 在本視窗是否已可用。
 *
 * VS Code 只在【視窗啟動】時把已安裝擴充套件的 `contributes.colors` 納入主題 CSS；
 * 執行期安裝（install / uninstall 後重裝）不會重建這些 CSS 變數，
 * 此時 `ThemeColor('colorfulRecentFiles.heat*')` 無法解析，FileDecoration 會完全不上色。
 *
 * 【為何不用 globalState 版本旗標】那個旗標只記「這個版本啟動過」，
 * 在「安裝 → 移除 → reload → 重裝」的流程下會殘留而誤判為已就緒，正是首載不上色的成因。
 *
 * 改以「安裝時間是否晚於 Extension Host 啟動」判定：若在本次啟動後才安裝，
 * 即可確定 token 尚未套用，改用內建 token 上色。
 *
 * 誤判方向刻意偏向「未就緒」（fallback）：fallback token 在各發行版都存在且不透明，
 * 即使誤用也只是首次工作階段色票略不同；反之誤判為已就緒則會完全不上色。
 *
 * epsilon 預設 30 秒（而非數秒）：除了檔案／程序時間顆粒度，也要涵蓋
 * 「安裝後不久發生 Extension Host 重啟、但視窗未 reload」（`Developer: Restart Extension Host`
 * 或 EH crash 重啟）的情形——此情境 `hostStartMs` 會往後移，若 epsilon 太小就會誤判為已就緒，
 * 但視窗主題 CSS 仍未重建，於是重現不上色。
 *
 * @param installedAtMs 擴充套件安裝時間（package.json 的 mtime）
 * @param hostStartMs Extension Host 啟動時間
 * @param epsilonMs 容忍誤差（檔案時間與程序啟動時間的顆粒度）
 */
export function decideHeatTokensReady(
  installedAtMs: number,
  hostStartMs: number,
  epsilonMs = 30_000
): boolean {
  if (!Number.isFinite(installedAtMs) || installedAtMs <= 0) return false;
  if (!Number.isFinite(hostStartMs) || hostStartMs <= 0) return false;
  return installedAtMs <= hostStartMs - epsilonMs;
}

/**
 * 判斷顏色字串是否含透明度（如 `rgba(…, 0.33)` 或 8 位 hex `#RRGGBBAA`）。
 * 供單元測試與未來擴充使用，不依賴 vscode。
 *
 * 註：目前 `src/` 內無呼叫點（純工具函式，由 `tests/unit/color.test.ts` 覆蓋）；
 * fallback token 的選擇已由常數 + 回歸測試（禁止 `charts.orange`）守住。
 */
export function isTransparentColor(value: string | undefined | null): boolean {
  if (!value) return true;
  const v = value.trim().toLowerCase();
  if (v === 'transparent') return true;
  const rgba = v.match(/^rgba\((?:[^,]+,\s*){3}([0-9.]+)\)$/);
  if (rgba) return Number(rgba[1]) < 1;
  if (/^#[0-9a-f]{8}$/.test(v)) return v.slice(7) !== 'ff';
  return false;
}

/** 設定本擴充套件貢獻的 heat token 是否已可用；false 時改用 FALLBACK_COLOR_IDS */
export function setHeatTokensReady(ready: boolean): void {
  heatTokensReady = ready;
}

/** 還原模組狀態為預設值（供單元測試避免順序耦合） */
export function resetHeatTokensReady(): void {
  heatTokensReady = true;
}

/** 取得第 index 級熱度色彩 token id（0 最新 ~ 5 最舊） */
export function getHeatColorId(index: number): string {
  return (heatTokensReady ? HEAT_COLOR_IDS : FALLBACK_COLOR_IDS)[index];
}

/**
 * 依順位比例取得熱度 ThemeColor id（t: 0.0 最新 ~ 1.0 最舊）。
 * 不直接使用 charts.*，避免上色結果隨使用者的 Color Theme 改變。
 */
export function getSpectrumThemeColorId(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped < 0.17) return getHeatColorId(0);
  if (clamped < 0.34) return getHeatColorId(1);
  if (clamped < 0.51) return getHeatColorId(2);
  if (clamped < 0.68) return getHeatColorId(3);
  if (clamped < 0.85) return getHeatColorId(4);
  return getHeatColorId(5);
}

/**
 * 產生帶有指定顏色的圓點 SVG Data URI
 */
export function createColorDotSvgDataUri(colorHex: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="5" fill="${colorHex}" /></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
