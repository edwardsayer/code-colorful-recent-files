import * as vscode from 'vscode';
import { RecentFilesManager } from './recentFilesManager';
import { RecentFolderElement, RecentTreeElement } from './types';
import { moveWithinPinnedOrder } from './util/groupSort';

/**
 * 分組拖曳排序控制器。
 *
 * 規則（依使用者核定）：
 * - 只有已 Pin 的分組可被拖曳；未 Pin 分組不可拖。
 * - 落點必須是已 Pin 的分組；拖到未 Pin 分組或平鋪檔案上不接受。
 * - 拖到空白處（target 為 undefined）＝附加到已 Pin 區塊末尾（仍排在未 Pin 之上）。
 */
export class RecentTreeDragAndDropController implements vscode.TreeDragAndDropController<RecentTreeElement> {
  public readonly dragMimeTypes = ['application/vnd.code.tree.codeColorfulRecentFiles'];
  public readonly dropMimeTypes = ['application/vnd.code.tree.codeColorfulRecentFiles'];

  constructor(
    private readonly manager: RecentFilesManager,
    private readonly onOrderChanged: () => void
  ) {}

  public handleDrag(source: readonly RecentTreeElement[], treeDataTransfer: vscode.DataTransfer): void {
    // 僅允許拖曳已 Pin 的分組
    const pinnedFolders = source.filter(
      (item): item is RecentFolderElement => item.kind === 'folder' && item.isPinned
    );
    if (pinnedFolders.length > 0) {
      treeDataTransfer.set(
        this.dragMimeTypes[0],
        new vscode.DataTransferItem(pinnedFolders.map((f) => f.folderKey))
      );
    }
  }

  public async handleDrop(target: RecentTreeElement | undefined, sources: vscode.DataTransfer): Promise<void> {
    const transferItem = sources.get(this.dropMimeTypes[0]);
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
