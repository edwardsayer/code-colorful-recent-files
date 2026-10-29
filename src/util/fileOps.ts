import * as path from 'node:path';

/**
 * 檔案操作的純邏輯（**不依賴 `vscode`**，可被 `tests/unit/` 直接載入）。
 *
 * 來源：`code-folder-spaces/src/spaces/spaceActions.ts` 的部分移植。
 * 依 `dev/code-colorful-recent-files/specs/file-operations-design.md` §2 的移植邊界，
 * 以下項目**刻意不移植**（不是漏掉，勿補）：
 *
 * - `isAllowedSpaceRoot`：本產品沒有「空間根」概念，可寫根邊界改由
 *   `requireTrust()` ＋ 同 provider 檢查 ＋ `isSafeMove()` ＋ 不覆寫承擔（spec §3.3）。
 * - `SpaceClipboard` / `ClipboardEntry`：本需求不含 copy／cut／paste。
 * - `uniqueEntryName` / `createEntry` 相關：本需求不含建立檔案／資料夾。
 * - `resolveDropTarget` / `resolvePasteTarget` / `hasDrillStateWithinMovedSources` /
 *   `DropTargetCandidate`：無 pane／drill 模型。
 * - `resolveOpenBeside`：開啟位置決策，與檔案操作無關。
 * - `validateSpaceName`：空間命名，非檔案操作。
 */

// ── 名稱與路徑驗證 ────────────────────────────────────────────────

/**
 * 取得指定平台的路徑 API。
 *
 * **必須明確挑 `path.posix`**：Node 的 `path` 在 Windows 主機上就是 `path.win32`，
 * 若寫成 `platform === 'win32' ? path.win32 : path`，在 Windows 上測非 win32 分支
 * 會拿到 win32 語意（曾因此讓 `isPathWithin('/proj', '/Proj/f.txt', 'linux')` 誤判為 true）。
 * 注入平台是為了讓測試能在任何主機上驗證兩個平台的規則。
 */
function pathApiFor(platform: NodeJS.Platform): path.PlatformPath {
  return platform === 'win32' ? path.win32 : path.posix;
}

/**
 * 檔案操作的名稱必須是單一且非特殊的路徑片段。
 *
 * Windows 額外規則：禁用 `<>:"|?*`、不得以點或空白結尾、不得為裝置名
 * （`CON`／`PRN`／`AUX`／`NUL`／`COM1-9`／`LPT1-9`，比對時忽略副檔名）。
 *
 * `platform` 可注入，讓測試能在任何主機上驗證 Windows 規則。
 */
export function isValidEntryName(name: string, platform: NodeJS.Platform = process.platform): boolean {
  if (!(name.trim() && name === name.trim() && name !== '.' && name !== '..' && !/[\\/\0]/.test(name))) {
    return false;
  }
  if (platform !== 'win32') return true;
  if (/[<>:"|?*]/.test(name) || /[. ]$/.test(name)) return false;
  const deviceName = name.split('.')[0].replace(/[. ]+$/, '').toUpperCase();
  return !/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(deviceName);
}

/**
 * 以主機平台的大小寫規則比較兩個路徑。
 * Windows 路徑不分大小寫；其他平台區分。
 */
export function isSamePath(source: string, target: string, platform: NodeJS.Platform = process.platform): boolean {
  const pathApi = pathApiFor(platform);
  const normalizedSource = pathApi.normalize(source);
  const normalizedTarget = pathApi.normalize(target);
  return platform === 'win32'
    ? normalizedSource.toLowerCase() === normalizedTarget.toLowerCase()
    : normalizedSource === normalizedTarget;
}

/**
 * 阻止把目錄搬進它自己或它的子目錄。非目錄一律允許。
 *
 * ⚠️ **已知限制**：只做詞法路徑比較，**不解析 realpath**。若 symlink／junction 指向來源的祖先，
 * 理論上可繞過此防護（spec §3.3 已登錄，與來源實作一致）。
 */
export function isSafeMove(source: string, target: string, isDirectory: boolean): boolean {
  if (!isDirectory) return true;
  const sourcePath = path.resolve(source);
  const targetPath = path.resolve(target);
  const relative = path.relative(sourcePath, targetPath);
  // 相同路徑（''）不安全；往上一層或跳到別處（'..'／絕對路徑）才是安全的。
  return relative !== '' && (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative));
}

// ── Undo ─────────────────────────────────────────────────────────

export interface UndoEntry {
  from: string;
  to: string;
  kind: 'move' | 'rename';
}

/** 上限沿用來源實作（20 筆）。 */
export const UNDO_STACK_LIMIT = 20;

/**
 * 有界操作歷史，**刻意獨立於 VS Code 編輯器的 undo stack**。
 *
 * 只存在記憶體：擴充重載即清空。僅支援 `move`／`rename`；`create`／`delete` 不支援 undo。
 */
export class UndoStack {
  private entries: UndoEntry[] = [];

  push(entry: UndoEntry): void {
    this.entries.push(entry);
    if (this.entries.length > UNDO_STACK_LIMIT) this.entries.shift();
  }

  peek(): UndoEntry | undefined {
    return this.entries[this.entries.length - 1];
  }

  pop(): UndoEntry | undefined {
    return this.entries.pop();
  }

  clear(): void {
    this.entries = [];
  }

  get size(): number {
    return this.entries.length;
  }
}

/** Workspace Trust 是擴充套件自行修改磁碟的唯一授權閘門。 */
export function canModifyFiles(isTrusted: boolean): boolean {
  return isTrusted;
}

// ── 歷史紀錄路徑改寫（本產品專屬；folder-spaces 無此問題）────────────

/** 改寫所需的最小紀錄形狀（避免本模組依賴 `vscode` 或 `types.ts`）。 */
export interface PathRecord {
  uri: string;
  fsPath: string;
  lastOpenedTime: number;
  lastModifiedTime: number;
}

/**
 * 路徑 `candidate` 是否為 `base` 本身或它的子項。
 *
 * 用 `path.relative` 判斷，避免字串前綴造成的兄弟路徑誤判
 * （例如 `C:\proj\a` 不應匹配 `C:\proj\ab`）。
 */
export function isPathWithin(base: string, candidate: string, platform: NodeJS.Platform = process.platform): boolean {
  if (isSamePath(base, candidate, platform)) return true;
  const pathApi = pathApiFor(platform);
  const relative = pathApi.relative(pathApi.resolve(base), pathApi.resolve(candidate));
  return relative !== '' && !relative.startsWith('..') && !pathApi.isAbsolute(relative);
}

/**
 * `rename`／`move` 後改寫歷史紀錄的路徑。
 *
 * - 命中 `from` 本身 → `fsPath` 換成 `to`
 * - 命中 `from` 的子項 → 只替換前綴，保留其餘相對路徑（搬移整個目錄時的情境）
 * - 未命中 → 原樣保留
 * - **`lastOpenedTime` 與 `lastModifiedTime` 一律保留**：移動不應讓檔案在清單中「變新」或「變舊」
 * - `uri` 依 `to` 重建（`file:` URI 由呼叫端決定 scheme，這裡只做字串層替換）
 *
 * 回傳新陣列，不修改輸入。
 */
export function rewriteRecordPaths(
  records: readonly PathRecord[],
  from: string,
  to: string,
  platform: NodeJS.Platform = process.platform
): PathRecord[] {
  const pathApi = pathApiFor(platform);
  return records.map((record) => {
    if (isSamePath(record.fsPath, from, platform)) {
      return { ...record, fsPath: to, uri: uriForPath(to, record.uri) };
    }
    if (isPathWithin(from, record.fsPath, platform)) {
      const suffix = pathApi.relative(pathApi.resolve(from), pathApi.resolve(record.fsPath));
      const nextPath = pathApi.join(to, suffix);
      return { ...record, fsPath: nextPath, uri: uriForPath(nextPath, record.uri) };
    }
    return { ...record };
  });
}

/**
 * 以既有 `uri` 的 scheme／authority 為模板重建新路徑的 URI 字串。
 * 保持原本的 scheme（本產品目前只有 `file:`，但不假設）。
 */
function uriForPath(nextPath: string, templateUri: string): string {
  const normalized = nextPath.split(path.sep).join('/');
  try {
    const parsed = new URL(templateUri);
    const scheme = parsed.protocol.replace(/:$/, '') || 'file';
    const authority = parsed.host || '';
    const encoded = normalized
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    // Windows 磁碟機路徑需要前導斜線：file:///c%3A/... 的形式由 encodeURIComponent 產生，
    // 但 ':' 應保留為 ':'（VS Code 的 Uri.file 也是保留）。這裡還原常見字元以貼近 Uri.toString()。
    const decoded = encoded.replace(/%3A/gi, ':');
    return `${scheme}://${authority}${decoded.startsWith('/') ? '' : '/'}${decoded}`;
  } catch {
    return templateUri;
  }
}

/**
 * `delete` 後從歷史紀錄移除該路徑**及其所有子項**（刪除目錄時的情境）。
 *
 * 回傳新陣列，不修改輸入。
 */
export function removeRecordPaths(
  records: readonly PathRecord[],
  target: string,
  platform: NodeJS.Platform = process.platform
): PathRecord[] {
  return records.filter((record) => !isPathWithin(target, record.fsPath, platform));
}

// ── 已 Pin 分組的 `dir:<path>` key 同步 ────────────────────────────

const DIR_KEY_PREFIX = 'dir:';

/** 由目錄絕對路徑產生 `pinnedGroupOrder` 使用的 key（與 `recentTreeDataProvider` 的組法一致）。 */
export function dirGroupKey(absolutePath: string): string {
  return `${DIR_KEY_PREFIX}${absolutePath.toLowerCase()}`;
}

/**
 * `rename`／`move` 後改寫 `pinnedGroupOrder` 中的 `dir:<path>` key。
 *
 * - `type:<ext>` key 一律不動（Type 分組與實體路徑無關）
 * - 命中 `from` 或其子項的 `dir:` key 會改寫前綴
 * - 順序保持不變（Pin 的手動順序不可因搬移而重排）
 * - 改寫後若產生重複 key，保留**最先出現**的那一個，避免同一目錄出現兩筆
 */
export function rewritePinnedDirKeys(
  pinnedOrder: readonly string[],
  from: string,
  to: string,
  platform: NodeJS.Platform = process.platform
): string[] {
  const pathApi = pathApiFor(platform);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const key of pinnedOrder) {
    let nextKey = key;
    if (key.startsWith(DIR_KEY_PREFIX)) {
      const keyPath = key.slice(DIR_KEY_PREFIX.length);
      if (isSamePath(keyPath, from, platform)) {
        nextKey = dirGroupKey(to);
      } else if (isPathWithin(from, keyPath, platform)) {
        const suffix = pathApi.relative(pathApi.resolve(from), pathApi.resolve(keyPath));
        nextKey = dirGroupKey(pathApi.join(to, suffix));
      }
    }
    if (!seen.has(nextKey)) {
      seen.add(nextKey);
      result.push(nextKey);
    }
  }
  return result;
}

/**
 * `delete` 後從 `pinnedGroupOrder` 移除該路徑及其子項的 `dir:` key。
 * `type:` key 不受影響。
 */
export function removePinnedDirKeys(
  pinnedOrder: readonly string[],
  target: string,
  platform: NodeJS.Platform = process.platform
): string[] {
  return pinnedOrder.filter((key) => {
    if (!key.startsWith(DIR_KEY_PREFIX)) return true;
    return !isPathWithin(target, key.slice(DIR_KEY_PREFIX.length), platform);
  });
}
