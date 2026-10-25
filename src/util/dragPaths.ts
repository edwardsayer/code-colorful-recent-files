import type { RecentTreeElement } from '../types';

/**
 * 從欲拖曳的樹節點中挑出「應輸出為檔案 URI」的路徑。
 *
 * 純邏輯、零 `vscode` 依賴，供單元測試與 `treeDragAndDrop` 共用。
 *
 * 規則：
 * - 只有 `kind === 'file'` 的節點會輸出。分組節點（folder）的 `folderKey` 只是目錄字串，
 *   不具「檔案」語意，拖到檔案總管／其他擴充套件時會變成無效落點，故一律排除。
 * - 同一路徑只輸出一次（避免多選時出現重複 URI，讓落點端重複搬移）。
 * - 空或非字串路徑直接忽略。
 *
 * @param source 目前被拖曳的節點
 * @returns 去重後的檔案絕對路徑，維持原始順序
 */
export function selectDraggableFilePaths(source: readonly RecentTreeElement[]): string[] {
  const seen = new Set<string>();
  const paths: string[] = [];

  for (const item of source) {
    if (item.kind !== 'file') continue;
    const fsPath = item.record?.fsPath;
    if (typeof fsPath !== 'string' || fsPath.length === 0) continue;

    // Windows 路徑大小寫不敏感，去重時統一比較鍵；輸出仍保留原樣。
    const key = process.platform === 'win32' ? fsPath.toLowerCase() : fsPath;
    if (seen.has(key)) continue;
    seen.add(key);
    paths.push(fsPath);
  }

  return paths;
}
