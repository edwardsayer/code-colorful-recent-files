/**
 * 從 `Tab.input` 解析檔案路徑的純邏輯（無 `vscode` 依賴，可單元測試）。
 *
 * 為什麼要抽出來：`Tab.input` 的形狀**隨 VS Code 版本變動**，而且變化是靜默的——
 * `feat.custom-editor-tracking`（2026-10-31）實測 VS Code 1.144.0 的圖片分頁在 Extension Host
 * 端的 `tab.input` 是 **`undefined`**（不是物件、也沒有任何欄位），同一份程式在
 * VSCodium 1.140.0 則正常收到 `{ uri, viewType }`。
 *
 * 舊寫法直接 `input.uri instanceof vscode.Uri`，因此對 `undefined` 會丟出 TypeError 前的短路
 * （`input.uri` 直接拋錯）或**默默不追蹤**，
 * 使用者只會覺得「剛開過的圖片不在清單裡」，日誌也沒有任何線索。這裡把判定抽成純函式，
 * 讓「空 input」變成可測試、可辨識的狀態，manager 才能據此留下一次性警告。
 *
 * 對應 stage `feat.custom-editor-tracking`（BACKLOG B-12）與 `specs/recent-files-design.md` §5。
 */

/** `Tab.input` 中可用的檔案位置。只保留本產品需要的兩個欄位。 */
export interface TabInputPath {
  scheme: string;
  fsPath: string;
}

/**
 * 取出 `input.uri`／`input.resource` 的檔案位置。
 *
 * 以**鴨子型別**判定（`scheme` 與 `fsPath` 皆為字串），不用 `instanceof`：
 * 跨 Extension Host 邊界送來的物件不保證與 `vscode.Uri` 同一個 realm，
 * 而 `instanceof` 失敗時沒有任何補救訊號。
 */
export function readTabInputPath(input: unknown): TabInputPath | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }
  const candidate = (input as { uri?: unknown }).uri ?? (input as { resource?: unknown }).resource;
  if (!candidate || typeof candidate !== 'object') {
    return undefined;
  }
  const { scheme, fsPath } = candidate as { scheme?: unknown; fsPath?: unknown };
  if (typeof scheme !== 'string' || typeof fsPath !== 'string' || scheme.length === 0 || fsPath.length === 0) {
    return undefined;
  }
  return { scheme, fsPath };
}

/**
 * `input` 是否是「沒有可用欄位」的形狀——涵蓋 VS Code 1.144.0 對 custom editor 分頁的實際表現
 * （**`undefined`**）與理論上的空物件。用於留下一次性診斷訊息，避免「不追蹤」變成無聲行為。
 *
 * 注意：`TabInputWebview` 雖然沒有 `uri`，但有 `viewType`，因此不算空；
 * 文字分頁一定有 `uri`。所以「沒有 input」本身就是異常訊號。
 */
export function isOpaqueTabInput(input: unknown): boolean {
  if (!input || typeof input !== 'object') {
    return true;
  }
  return Object.getOwnPropertyNames(input).length === 0;
}
