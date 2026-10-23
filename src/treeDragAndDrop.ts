import * as vscode from 'vscode';
import { setFolderSortOrder } from './config';
import { RecentFilesManager } from './recentFilesManager';
import { RecentFolderElement, RecentTreeElement } from './types';

export class RecentTreeDragAndDropController implements vscode.TreeDragAndDropController<RecentTreeElement> {
  public readonly dragMimeTypes = ['application/vnd.code.tree.codeColorfulRecentFiles'];
  public readonly dropMimeTypes = ['application/vnd.code.tree.codeColorfulRecentFiles'];

  constructor(
    private readonly manager: RecentFilesManager,
    private readonly onOrderChanged: () => void
  ) {}

  public handleDrag(source: readonly RecentTreeElement[], treeDataTransfer: vscode.DataTransfer): void {
    const folders = source.filter((item): item is RecentFolderElement => item.kind === 'folder');
    if (folders.length > 0) {
      treeDataTransfer.set(
        this.dragMimeTypes[0],
        new vscode.DataTransferItem(folders.map((f) => f.folderKey))
      );
    }
  }

  public async handleDrop(target: RecentTreeElement | undefined, sources: vscode.DataTransfer): Promise<void> {
    const transferItem = sources.get(this.dropMimeTypes[0]);
    if (!transferItem) return;

    const draggedKeys: string[] = transferItem.value;
    if (!Array.isArray(draggedKeys) || draggedKeys.length === 0) return;

    let currentOrder = [...this.manager.getFolderManualOrder()];

    // 移除已存在的拖曳項目
    currentOrder = currentOrder.filter((k) => !draggedKeys.includes(k));

    if (target && target.kind === 'folder') {
      const targetIndex = currentOrder.indexOf(target.folderKey);
      if (targetIndex !== -1) {
        currentOrder.splice(targetIndex, 0, ...draggedKeys);
      } else {
        currentOrder.push(...draggedKeys);
      }
    } else {
      currentOrder.push(...draggedKeys);
    }

    await this.manager.setFolderManualOrder(currentOrder);
    await setFolderSortOrder('manual');
    this.onOrderChanged();
  }
}
