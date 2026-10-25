import * as vscode from 'vscode';
import { RecentFilesManager } from './recentFilesManager';
import { RecentFileElement, RecentFolderElement, RecentTreeElement } from './types';

const PREFIX = 'codeColorfulRecentFiles.';

/** 取得右鍵目標對應的實體 Uri（Type 分組節點沒有實體路徑） */
function resolveUri(element: RecentTreeElement | undefined): vscode.Uri | undefined {
  if (!element) return undefined;
  if (element.kind === 'file') return vscode.Uri.file(element.record.fsPath);
  return element.groupKind === 'directory' ? vscode.Uri.file(element.folderAbsolutePath) : undefined;
}

/**
 * 以 Uri 為引數轉交 VS Code 內建命令。
 * 分頁類內建命令（pin、closeOthers、split…）接受 Uri 並自行定位該分頁，不需先切換作用中分頁。
 */
function forward(id: string, builtin: string): [string, (element?: RecentTreeElement) => Promise<void>] {
  return [
    id,
    async (element) => {
      const uri = resolveUri(element);
      if (uri) await vscode.commands.executeCommand(builtin, uri);
    },
  ];
}

async function confirmBatch(message: string, action: string, count: number): Promise<boolean> {
  if (count < 2) return true;
  const answer = await vscode.window.showWarningMessage(message, { modal: true }, action);
  return answer === action;
}

/** 註冊 view/item/context 右鍵選單命令（皆不出現在命令面板） */
export function registerContextMenuCommands(context: vscode.ExtensionContext, manager: RecentFilesManager): void {
  const handlers: Array<[string, (element?: RecentTreeElement) => Promise<void>]> = [
    forward('openToSide', 'explorer.openToSide'),
    forward('closeOthers', 'workbench.action.closeOtherEditors'),
    forward('closeSaved', 'workbench.action.closeUnmodifiedEditors'),
    forward('closeAll', 'workbench.action.closeAllEditors'),
    forward('splitRight', 'workbench.action.splitEditorRight'),
    forward('splitDown', 'workbench.action.splitEditorDown'),
    forward('moveToNewWindow', 'workbench.action.moveEditorToNewWindow'),
    forward('copyPath', 'copyFilePath'),
    forward('copyRelativePath', 'copyRelativeFilePath'),
    forward('revealInExplorer', 'revealInExplorer'),
    forward('revealInOS', 'revealFileInOS'),
    forward('openInTerminal', 'openInTerminal'),
    forward('findInFolder', 'filesExplorer.findInFolder'),
    [
      'closeTab',
      async (element) => {
        if (element?.kind === 'file') await manager.closeTabForFile(element.record.fsPath);
      },
    ],
    [
      'togglePin',
      async (element) => {
        if (element?.kind !== 'file') return;
        const tab = manager.getTabsForFiles([element.record.fsPath])[0];
        if (!tab) return;
        await vscode.commands.executeCommand(
          tab.isPinned ? 'workbench.action.unpinEditor' : 'workbench.action.pinEditor',
          vscode.Uri.file(element.record.fsPath)
        );
      },
    ],
    [
      'pinGroup',
      async (element) => {
        if (element?.kind !== 'folder') return;
        const key = element.folderKey;
        if (!element.isPinned) await manager.togglePinnedGroup(key);
      },
    ],
    [
      'unpinGroup',
      async (element) => {
        if (element?.kind !== 'folder') return;
        const key = element.folderKey;
        if (element.isPinned) await manager.togglePinnedGroup(key);
      },
    ],
    [
      'closeGroup',
      async (element) => {
        if (element?.kind !== 'folder') return;
        const paths = (element as RecentFolderElement).files.map((r) => r.fsPath);
        const count = manager.getTabsForFiles(paths).length;
        if (await confirmBatch(vscode.l10n.t('Close {0} tabs in this group?', count), vscode.l10n.t('Close Tabs'), count)) {
          await manager.closeTabsForFiles(paths);
        }
      },
    ],
    [
      'removeGroup',
      async (element) => {
        if (element?.kind !== 'folder') return;
        const files = (element as RecentFolderElement).files;
        if (
          await confirmBatch(
            vscode.l10n.t('Remove {0} files in this group from history?', files.length),
            vscode.l10n.t('Remove'),
            files.length
          )
        ) {
          for (const record of files) {
            await manager.removeRecord(record.uri);
          }
        }
      },
    ],
  ];

  for (const [id, handler] of handlers) {
    context.subscriptions.push(
      vscode.commands.registerCommand(PREFIX + id, (element?: RecentFileElement | RecentFolderElement) => handler(element))
    );
  }
}
