import * as path from 'node:path';

/**
 * 從檔案路徑中萃取檔案類型分組名稱 (統一轉為大寫，如 'TS', 'JSON', 'PNG')
 * 無副檔名或無法識別者歸類為 'OTHER'
 */
export function getFileTypeGroup(fsPath: string): string {
  if (!fsPath) return 'OTHER';

  const ext = path.extname(fsPath);
  if (ext && ext.length > 1) {
    return ext.slice(1).toUpperCase();
  }

  // 無一般副檔名，檢查是否為特殊檔名 (如 .gitignore, Dockerfile 等)
  const basename = path.basename(fsPath);
  if (basename.startsWith('.') && basename.length > 1) {
    return basename.slice(1).toUpperCase();
  }

  return 'OTHER';
}
