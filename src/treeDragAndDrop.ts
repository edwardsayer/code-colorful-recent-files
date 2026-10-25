import * as vscode from 'vscode';
import { RecentFilesManager } from './recentFilesManager';
import { RecentFolderElement, RecentTreeElement } from './types';
import { selectDraggableFilePaths } from './util/dragPaths';
import { moveWithinPinnedOrder } from './util/groupSort';

/** 內部重排用的 MIME（只有本套件自己的 view 會讀） */
const INTERNAL_MIME = 'application/vnd.code.tree.codeColorfulRecentFiles';

/**
 * 跨 view 拖放的標準 MIME。
 *
 * VS Code 會為每個拖曳自動加入 `text/uri-list`，但內容是**本套件自訂 scheme**
 * （`colorful-recent:/...`），其他擴充套件（含原生 Explorer 與 code-folder-spaces）
 * 一律只接受 `file:` scheme，會直接忽略。因此必須在 `handleDrag` 內主動覆寫成
 * `file:` URI，拖放才會真正生效。
 */
export const URI_LIST_MIME = 'text/uri-list';

/**
 * 分組拖曳排序 + 檔案跨 view 拖出控制器。
 *
 * 分組規則（依使用者核定）：
 * - 只有已 Pin 的分組可被拖曳；未 Pin 分組不可拖。
 * - 落點必須是已 Pin 的分組；拖到未 Pin 分組或平鋪檔案上不接受。
 * - 拖到空白處（target 為 undefined）＝附加到已 Pin 區塊末尾（仍排在未 Pin 之上）。
 *
 * 檔案規則：
 * - 檔案節點一律以 `file:` URI 寫入 `text/uri-list`，可拖到原生 Explorer、
 *   本套件自己的 view，或同 workspace 內其他接受 `text/uri-list` 的樹（如
 *   `code-folder-spaces`）。分組節點的 folderKey 只是目錄字串，不具檔案語意，
 *   故不輸出檔案 URI。
 * - 拖放本身不做任何檔案搬移；搬移／複製由落點那一方決定（本套件不持有檔案所有權）。
 */
/**
 * 把可拖曳的檔案節點轉成 `file:` URI 字串。
 * 選取規則本身抽在 `util/dragPaths`（純邏輯、可單元測試）。
 */
export function collectDraggableFileUris(source: readonly RecentTreeElement[]): string[] {
  return selectDraggableFilePaths(source).map((fsPath) => vscode.Uri.file(fsPath).toString());
}

export class RecentTreeDragAndDropController implements vscode.TreeDragAndDropController<RecentTreeElement> {
  public readonly dragMimeTypes = [INTERNAL_MIME, URI_LIST_MIME];
  public readonly dropMimeTypes = [INTERNAL_MIME];

  constructor(
    private readonly manager: RecentFilesManager,
    private readonly onOrderChanged: () => void
  ) {}

  public handleDrag(source: readonly RecentTreeElement[], treeDataTransfer: vscode.DataTransfer): void {
    // 1) 已 Pin 分組：寫入內部 MIME，供同 view 內重排使用
    const pinnedFolders = source.filter(
      (item): item is RecentFolderElement => item.kind === 'folder' && item.isPinned
    );
    if (pinnedFolders.length > 0) {
      treeDataTransfer.set(INTERNAL_MIME, new vscode.DataTransferItem(pinnedFolders.map((f) => f.folderKey)));
    }

    // 2) 檔案節點：寫入 file: URI，供跨 view / 跨擴充套件拖放
    //    注意：VS Code 預設給的 text/uri-list 是自訂 scheme，會被外部忽略，所以必須覆寫。
    const fileUris = collectDraggableFileUris(source);
    if (fileUris.length > 0) {
      treeDataTransfer.set(URI_LIST_MIME, new vscode.DataTransferItem(fileUris.join('\r\n')));
    }
  }

  public async handleDrop(target: RecentTreeElement | undefined, sources: vscode.DataTransfer): Promise<void> {
    const transferItem = sources.get(INTERNAL_MIME);
    if (!transferItem) return;

    const draggedKeys: string[] = transferItem.value;
    if (!Array.isArray(draggedKeys) || draggedKeys.length === 0) return;

    const currentOrder = this.manager.getPinnedGroupOrder();

    // 落點必須是已 Pin 的分組；未 Pin 分組與檔案節點一律不接受拖放
    if (target !== undefined) {
      if (target.kind !== 'folder' || !target.isPinned) return;
    }

    const nextOrder = moveWithinPinnedOrder(currentOrder, draggedKeys, target?.kind === 'folder' ? target.folderKey : undefined);
    if (nextOrder.join('\u0000') === currentOrder.join('\u0000')) {
      return;
    }

    await this.manager.setPinnedGroupOrder(nextOrder);
    this.onOrderChanged();
  }
}
