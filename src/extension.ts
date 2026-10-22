import * as vscode from 'vscode';
import { getExtensionConfig, setColorScheme, setGroupByDirectory } from './config';
import { RecentFileDecorationProvider } from './recentFileDecorationProvider';
import { RecentFilesManager } from './recentFilesManager';
import { RecentTreeDataProvider } from './recentTreeDataProvider';
import { RECENT_FOLDER_SCHEME, RECENT_SCHEME, RecentFileElement } from './types';
import { initLogger, logInfo } from './util/log';
import { DummyFileSystemProvider } from './util/virtualFs';

export function activate(context: vscode.ExtensionContext): void {
  initLogger(context);
  logInfo('Activating Colorful Recent Files extension...');

  // 註冊虛擬 FileSystemProvider，使 VS Code FileDecoration 系統能辨識自訂 scheme 並正常賦予色彩與標注
  const dummyFs = new DummyFileSystemProvider();
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(RECENT_SCHEME, dummyFs, {
      isCaseSensitive: false,
      isReadonly: true,
    })
  );
  context.subscriptions.push(
    vscode.workspace.registerFileSystemProvider(RECENT_FOLDER_SCHEME, dummyFs, {
      isCaseSensitive: false,
      isReadonly: true,
    })
  );

  const manager = new RecentFilesManager(context);
  const treeDataProvider = new RecentTreeDataProvider(manager);
  const decorationProvider = new RecentFileDecorationProvider(manager);

  // 註冊 TreeView
  const treeView = vscode.window.createTreeView('codeColorfulRecentFiles.recentView', {
    treeDataProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // 註冊 FileDecorationProvider
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(decorationProvider)
  );

  // 監聽 configuration 變更
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('codeColorfulRecentFiles')) {
        treeDataProvider.refresh();
        decorationProvider.fireChange();
      }
    })
  );

  // 註冊指令：重新整理
  context.subscriptions.push(
    vscode.commands.registerCommand('codeColorfulRecentFiles.refresh', async () => {
      await manager.pruneMissingFiles();
      treeDataProvider.refresh();
      decorationProvider.fireChange();
    })
  );

  // 註冊指令：切換目錄分組
  context.subscriptions.push(
    vscode.commands.registerCommand('codeColorfulRecentFiles.toggleGroupByDirectory', async () => {
      const config = getExtensionConfig();
      const nextValue = !config.groupByDirectory;
      await setGroupByDirectory(nextValue);
      treeDataProvider.refresh();
    })
  );

  // 註冊指令：切換配色方案 (彩虹順位色譜 vs 時間階梯)
  context.subscriptions.push(
    vscode.commands.registerCommand('codeColorfulRecentFiles.toggleColorScheme', async () => {
      const config = getExtensionConfig();
      const nextScheme = config.colorScheme === 'rankSpectrum' ? 'timeBucket' : 'rankSpectrum';
      await setColorScheme(nextScheme);
      treeDataProvider.refresh();
      decorationProvider.fireChange();
    })
  );

  // 註冊指令：清除全部歷史紀錄
  context.subscriptions.push(
    vscode.commands.registerCommand('codeColorfulRecentFiles.clearHistory', async () => {
      const message = vscode.l10n.t('confirm.clearHistory');
      const actionClear = vscode.l10n.t('action.clear');
      const actionCancel = vscode.l10n.t('action.cancel');

      const answer = await vscode.window.showWarningMessage(
        message,
        { modal: true },
        actionClear,
        actionCancel
      );

      if (answer === actionClear) {
        await manager.clearAll();
        vscode.window.showInformationMessage(vscode.l10n.t('info.historyCleared'));
      }
    })
  );

  // 註冊指令：移除單一項目
  context.subscriptions.push(
    vscode.commands.registerCommand('codeColorfulRecentFiles.removeItem', async (element?: RecentFileElement) => {
      if (element && element.record?.uri) {
        await manager.removeRecord(element.record.uri);
      }
    })
  );

  // 註冊指令：開啟檔案 (主動更新時間記錄並將該檔案置頂)
  context.subscriptions.push(
    vscode.commands.registerCommand('codeColorfulRecentFiles.openFile', async (uri: vscode.Uri) => {
      if (uri) {
        await manager.recordAccess(uri, 'open');
        await vscode.commands.executeCommand('vscode.open', uri);
      }
    })
  );

  logInfo('Colorful Recent Files extension activated successfully.');
}

export function deactivate(): void {
  // 資源由 context.subscriptions 自動處置
}
