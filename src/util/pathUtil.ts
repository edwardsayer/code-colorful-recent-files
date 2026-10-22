import * as path from 'node:path';

/** 將本機路徑統一正規化為 canonical key (Windows 不分大小寫) */
export function normalizePathKey(fsPath: string): string {
  try {
    return path.normalize(fsPath).toLowerCase();
  } catch {
    return fsPath.toLowerCase();
  }
}
