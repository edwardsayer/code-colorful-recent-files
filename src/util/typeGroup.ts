import * as path from 'node:path';

/**
 * 從檔案路徑中萃取檔案類型分組名稱 (統一轉為大寫，如 'TS', 'JSON', 'PNG')
 * 特殊純數字副檔名/標識規則：
 * - 1 到 3 碼數字：'1-3 DIGITS'
 * - 4 到 6 碼數字：'4-6 DIGITS'
 * - 7 碼以上數字：'7+ DIGITS'
 * 無副檔名或無法識別者歸類為 'OTHER'
 */
export function getFileTypeGroup(fsPath: string): string {
  if (!fsPath) return 'OTHER';

  const ext = path.extname(fsPath);
  let candidate = '';
  if (ext && ext.length > 1) {
    candidate = ext.slice(1);
  } else {
    // 無一般副檔名，檢查點開頭檔名 (如 .gitignore, .001) 或無副檔名檔名 (如 12345)
    const basename = path.basename(fsPath);
    if (basename.startsWith('.') && basename.length > 1) {
      candidate = basename.slice(1);
    } else if (basename && !basename.startsWith('.')) {
      candidate = basename;
    }
  }

  // 特殊純數字規則：1~3 碼、4~6 碼、7 碼以上
  if (/^\d+$/.test(candidate)) {
    const len = candidate.length;
    if (len >= 1 && len <= 3) {
      return '1-3 DIGITS';
    } else if (len >= 4 && len <= 6) {
      return '4-6 DIGITS';
    } else {
      return '7+ DIGITS';
    }
  }

  // 常規副檔名轉為全大寫
  if (ext && ext.length > 1) {
    return ext.slice(1).toUpperCase();
  }

  // 點開頭特殊隱藏檔 (如 .gitignore -> GITIGNORE)
  const basename = path.basename(fsPath);
  if (basename.startsWith('.') && basename.length > 1) {
    return basename.slice(1).toUpperCase();
  }

  return 'OTHER';
}
