import * as path from 'node:path';
import * as vscode from 'vscode';
import { RecentFilesManager } from './recentFilesManager';
import { RecentTreeElement } from './types';
import { isValidEntryName, isSafeMove, isSamePath, UndoStack } from './util/fileOps';
import { logError, logInfo } from './util/log';
import { requireTrust } from './util/trust';

const PREFIX = 'codeColorfulRecentFiles.';

/**
 * 檔案操作命令（Rename／Move To／Delete／Undo）。
 *
 * 與 `contextMenu.ts` 的分工：那支只轉交 VS Code 內建命令，不碰磁碟；
 * 本模組是唯一會修改磁碟的地方，因此**每個命令進入點都先過 `requireTrust()`**。
 * manifest 的 `when: isWorkspaceTrusted` 只是 UI 條件，不能取代執行期檢查。
 *
 * 設計依據：`dev/code-colorful-recent-files/specs/file-operations-design.md`
 */

/** 取得目前選取的檔案節點；`folder`／`type` 分組節點一律回 undefined。 */
function selectedFile(view: vscode.TreeView<RecentTreeElement>): RecentTreeElement | undefined {
  const element = view.selection[0];
  return element?.kind === 'file' ? element : undefined;
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

function reportError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  logError('File operation failed', error);
  void vscode.window.showErrorMessage(vscode.l10n.t('File operation failed: {0}', message));
}

/**
 * 收集 Move To 的目的地候選（spec §3.1）。
 *
 * 順序：工作區根 → 歷史紀錄中出現過的目錄（去重）→ 尾端 Browse。
 * 不列舉歷史目錄的遞迴子目錄：歷史可能指向大型目錄，成本不可控。
 */
function collectMoveTargets(manager: RecentFilesManager): Array<vscode.QuickPickItem & { folder?: string }> {
  const items: Array<vscode.QuickPickItem & { folder?: string }> = [];
  const seen = new Set<string>();

  const push = (folderPath: string, label: string, description: string): void => {
    const key = folderPath.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    items.push({ label, description, folder: folderPath });
  };

  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    if (folder.uri.scheme !== 'file') continue;
    push(folder.uri.fsPath, folder.name, folder.uri.fsPath);
  }

  for (const record of manager.getRecords()) {
    const directory = path.dirname(record.fsPath);
    push(directory, path.basename(directory) || directory, directory);
  }

  items.push({ label: vscode.l10n.t('Browse for folder…'), description: '' });
  return items;
}

export interface FileOperationHooks {
  /** 操作成功後重畫樹（歷史已由 manager 更新，這裡只負責畫面） */
  refresh: () => void;
}

export function registerFileOperationCommands(
  context: vscode.ExtensionContext,
  manager: RecentFilesManager,
  view: vscode.TreeView<RecentTreeElement>,
  hooks: FileOperationHooks
): void {
  const undoStack = new UndoStack();

  /**
   * 讓 keybinding 能精確判斷「目前選取的是檔案還是分組」。
   *
   * `viewItem` 只在 `view/item/context` 選單有效，在 keybinding 的 `when` 中恆為 false
   * （實機證實，見 dev/code-colorful-recent-files/tests/feat/R3/fod-01-viewitem-keybinding.md）。
   * 因此改用自訂 context key，由選取事件維護。
   */
  const applySelectionKind = (element: RecentTreeElement | undefined): void => {
    const kind = !element ? 'none' : element.kind === 'file' ? 'file' : element.groupKind;
    void vscode.commands.executeCommand('setContext', `${PREFIX}selectedKind`, kind);
  };
  applySelectionKind(undefined);
  context.subscriptions.push(
    view.onDidChangeSelection((event) => applySelectionKind(event.selection[0]))
  );

  const renameEntry = async (element?: RecentTreeElement): Promise<void> => {
    if (!requireTrust()) return;
    const target = element?.kind === 'file' ? element : selectedFile(view);
    if (!target || target.kind !== 'file') return;

    const sourcePath = target.record.fsPath;
    const source = vscode.Uri.file(sourcePath);
    const name = await vscode.window.showInputBox({
      prompt: vscode.l10n.t('Enter a new name'),
      value: path.basename(sourcePath),
      valueSelection: [0, path.basename(sourcePath).length],
      validateInput: (value) =>
        isValidEntryName(value) ? undefined : vscode.l10n.t('Enter a valid single file or folder name.'),
    });
    if (name === undefined || name === path.basename(sourcePath)) return;

    const destination = vscode.Uri.joinPath(vscode.Uri.file(path.dirname(sourcePath)), name);
    try {
      if (!(await exists(source))) {
        void vscode.window.showErrorMessage(vscode.l10n.t('The file no longer exists: {0}', sourcePath));
        return;
      }
      if (await exists(destination)) {
        void vscode.window.showErrorMessage(vscode.l10n.t('The target already exists: {0}', destination.fsPath));
        return;
      }
      await vscode.workspace.fs.rename(source, destination, { overwrite: false });
      undoStack.push({ kind: 'rename', from: sourcePath, to: destination.fsPath });
      await manager.applyPathRewrite(sourcePath, destination.fsPath);
      hooks.refresh();
      logInfo(`Renamed ${sourcePath} -> ${destination.fsPath}`);
    } catch (error) {
      reportError(error);
    }
  };

  const moveTo = async (element?: RecentTreeElement): Promise<void> => {
    if (!requireTrust()) return;
    const target = element?.kind === 'file' ? element : selectedFile(view);
    if (!target || target.kind !== 'file') return;

    const sourcePath = target.record.fsPath;
    const source = vscode.Uri.file(sourcePath);
    const picked = await vscode.window.showQuickPick(collectMoveTargets(manager), {
      placeHolder: vscode.l10n.t('Choose a destination folder'),
    });
    if (!picked) return;

    let destinationFolder = picked.folder;
    if (!destinationFolder) {
      const chosen = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: vscode.l10n.t('Move here'),
      });
      destinationFolder = chosen?.[0]?.fsPath;
    }
    if (!destinationFolder) return;

    if (isSamePath(path.dirname(sourcePath), destinationFolder)) return;

    const destination = vscode.Uri.joinPath(vscode.Uri.file(destinationFolder), path.basename(sourcePath));
    if (isSamePath(sourcePath, destination.fsPath)) return;

    try {
      const stat = await vscode.workspace.fs.stat(source);
      if (!isSafeMove(sourcePath, destination.fsPath, Boolean(stat.type & vscode.FileType.Directory))) {
        void vscode.window.showErrorMessage(
          vscode.l10n.t('A folder cannot be moved into itself or one of its subfolders.')
        );
        return;
      }
      const destinationStat = await vscode.workspace.fs.stat(vscode.Uri.file(destinationFolder));
      if (!(destinationStat.type & vscode.FileType.Directory)) {
        void vscode.window.showErrorMessage(vscode.l10n.t('The destination is not a folder: {0}', destinationFolder));
        return;
      }
      if (await exists(destination)) {
        void vscode.window.showErrorMessage(vscode.l10n.t('The target already exists: {0}', destination.fsPath));
        return;
      }
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: vscode.l10n.t('Moving {0}', path.basename(sourcePath)) },
        async () => vscode.workspace.fs.rename(source, destination, { overwrite: false })
      );
      undoStack.push({ kind: 'move', from: sourcePath, to: destination.fsPath });
      await manager.applyPathRewrite(sourcePath, destination.fsPath);
      hooks.refresh();
      logInfo(`Moved ${sourcePath} -> ${destination.fsPath}`);
    } catch (error) {
      reportError(error);
    }
  };

  const deleteEntry = async (element?: RecentTreeElement): Promise<void> => {
    if (!requireTrust()) return;
    const target = element?.kind === 'file' ? element : selectedFile(view);
    if (!target || target.kind !== 'file') return;

    const sourcePath = target.record.fsPath;
    const source = vscode.Uri.file(sourcePath);
    try {
      const stat = await vscode.workspace.fs.stat(source);
      const isDirectory = Boolean(stat.type & vscode.FileType.Directory);

      if (vscode.workspace.getConfiguration('explorer').get<boolean>('confirmDelete', true)) {
        const action = vscode.l10n.t('Delete');
        const answer = await vscode.window.showWarningMessage(
          vscode.l10n.t('Delete "{0}"?', path.basename(sourcePath)),
          { modal: true },
          action
        );
        if (answer !== action) return;
      }

      const useTrash = vscode.workspace.getConfiguration('files').get<boolean>('enableTrash', true);
      // 沒有通用的 trash capability API：非 file: provider 可能忽略 useTrash 而靜默永久刪除，
      // 因此一律拒絕（spec §4.2）。
      if (useTrash && source.scheme !== 'file') {
        void vscode.window.showErrorMessage(
          vscode.l10n.t('This file system provider does not expose trash support; the item was not deleted.')
        );
        return;
      }

      await vscode.workspace.fs.delete(source, { recursive: isDirectory, useTrash });
      await manager.applyPathRemoval(sourcePath);
      hooks.refresh();
      logInfo(`Deleted ${sourcePath}`);
    } catch (error) {
      reportError(error);
    }
  };

  const undoFileOperation = async (): Promise<void> => {
    if (!requireTrust()) return;
    const entry = undoStack.peek();
    if (!entry) {
      void vscode.window.showInformationMessage(vscode.l10n.t('There is no file operation to undo.'));
      return;
    }
    const source = vscode.Uri.file(entry.from);
    const target = vscode.Uri.file(entry.to);
    try {
      if (!(await exists(target))) {
        void vscode.window.showErrorMessage(vscode.l10n.t('Cannot undo: the moved item no longer exists: {0}', entry.to));
        return;
      }
      if (await exists(source)) {
        void vscode.window.showErrorMessage(
          vscode.l10n.t('Cannot undo: the original path already exists: {0}', entry.from)
        );
        return;
      }
      await vscode.workspace.fs.rename(target, source, { overwrite: false });
      undoStack.pop();
      await manager.applyPathRewrite(entry.to, entry.from);
      hooks.refresh();
      logInfo(`Undid ${entry.kind}: ${entry.to} -> ${entry.from}`);
    } catch (error) {
      reportError(error);
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand(`${PREFIX}renameEntry`, (element?: RecentTreeElement) => renameEntry(element)),
    vscode.commands.registerCommand(`${PREFIX}moveTo`, (element?: RecentTreeElement) => moveTo(element)),
    vscode.commands.registerCommand(`${PREFIX}deleteEntry`, (element?: RecentTreeElement) => deleteEntry(element)),
    vscode.commands.registerCommand(`${PREFIX}undoFileOperation`, () => undoFileOperation())
  );
}
