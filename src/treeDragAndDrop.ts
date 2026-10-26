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
 * （`colorful-recent:/...`），只接受 `file:` scheme 的落點會無法解析。
 * 因此在 `handleDrag` 內主動覆寫成 `file:` URI。
 *
 * ⚠️ 覆寫只對「接受 text/uri-list 的落點」有效（例如編輯器）。
 * 原生 File Explorer 一律拒絕，成因見下方 controller 的類別註解。
 */
export const URI_LIST_MIME = 'text/uri-list';

/**
 * VS Code 內部實際傳給樹狀落點的 MIME。
 *
 * 必須同時列在 `dragMimeTypes`：VS Code 只會為**已宣告**的類型建立 drag 階段的
 * 佔位 entry（`addExtensionProvidedTransferTypes()` 對 `dragMimeTypes` 逐項
 * `setData(mime, '')`）；未宣告者雖可由本套件 `set()`，但會在 renderer log 產生
 * `does not declare them in dragMimeTypes` warning，且對外落點看不到該類型。
 */
export const VND_URI_LIST_MIME = 'application/vnd.code.uri-list';

/**
 * 分組拖曳排序 + 檔案跨 view 拖出控制器。
 *
 * 分組規則（依使用者核定）：
 * - 只有已 Pin 的分組可被拖曳；未 Pin 分組不可拖。
 * - 落點必須是已 Pin 的分組；拖到未 Pin 分組或平鋪檔案上不接受。
 * - 拖到空白處（target 為 undefined）＝附加到已 Pin 區塊末尾（仍排在未 Pin 之上）。
 *
 * 檔案規則：
 * - 檔案節點以真實 `file:` URI 寫入 `text/uri-list` 與 `application/vnd.code.uri-list`，
 *   可拖到編輯器或其他接受 `text/uri-list` 的落點。分組節點的 folderKey 只是目錄字串，
 *   不具檔案語意，故不輸出檔案 URI。
 * - 拖放本身不做任何檔案搬移；搬移／複製由落點那一方決定（本套件不持有檔案所有權）。
 *
 * ⚠️ 平台硬限制：**拖不進原生 File Explorer**。
 * VS Code 核心 `workbench.desktop.main.js` 的 FileExplorer `handleDragOver` 內有
 * `if (o instanceof Lvt) return !1;`，而 `Lvt`（僅含 `{elements}`）是**任何** Monaco tree
 * 在 `onDragStart` 時寫入全域 `CurrentDragAndDropData` 的物件。只有 OS 層拖入
 * （`f8` / `DesktopDragAndDropData`）與 Explorer 自家內部模型能通過。
 * 因此本套件、`code-folder-spaces` 或任何擴充套件的樹狀拖曳都無法拖進原生 Explorer；
 * 改 MIME 或 `resourceUri` 都無法繞過（已實測：payload 正確 ≠ drop 有效）。
 * 跨資料夾操作請引導使用者用同套件 pane 間拖放，或 Explorer 內剪下／貼上。
 */
/**
 * 把可拖曳的檔案節點轉成 `file:` URI 字串。
 * 選取規則本身抽在 `util/dragPaths`（純邏輯、可單元測試）。
 */
export function collectDraggableFileUris(source: readonly RecentTreeElement[]): string[] {
  return selectDraggableFilePaths(source).map((fsPath) => vscode.Uri.file(fsPath).toString());
}

export class RecentTreeDragAndDropController implements vscode.TreeDragAndDropController<RecentTreeElement> {
  // `VND_URI_LIST_MIME` 必須宣告，否則 VS Code 會警告且該 MIME 對外不可見（見常數註解）。
  public readonly dragMimeTypes = [INTERNAL_MIME, URI_LIST_MIME, VND_URI_LIST_MIME];
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

    // 2) 檔案節點：寫入 file: URI，供跨 view / 跨擴充套件拖放。
    //    VS Code 會自動加入 `application/vnd.code.uri-list`，但值是從 resourceUri 推導的自訂 scheme
    //    (`colorful-recent:`)，只接受 file: 的落點無法解析。兩個 MIME 都覆寫：
    //    - `text/uri-list`：給編輯器、接受標準 MIME 的落點
    //    - `application/vnd.code.uri-list`：VS Code 內部傳給樹狀落點（含 Folder Spaces）的那一份
    //    兩者皆已列入 `dragMimeTypes`；未宣告會產生 warning 且對外不可見。
    //    註：此覆寫無法讓拖放進入原生 File Explorer（平台層 dragover 攔截，見類別註解）。
    const fileUris = collectDraggableFileUris(source);
    if (fileUris.length > 0) {
      const serialized = fileUris.join('\r\n');
      treeDataTransfer.set(URI_LIST_MIME, new vscode.DataTransferItem(serialized));
      treeDataTransfer.set(VND_URI_LIST_MIME, new vscode.DataTransferItem(serialized));
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
