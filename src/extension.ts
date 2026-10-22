import * as vscode from 'vscode';
import {
  getExtensionConfig,
  setColorScheme,
  setGroupByDirectory,
  setHighlightMode,
  setShowColorDotIcon,
  setStyleNativeExplorer,
} from './config';
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

  // 監聽顏色主題變更，確保切換深色/淺色主題時小圓點與標記能即時適應
  context.subscriptions.push(
    vscode.window.onDidChangeActiveColorTheme(() => {
      treeDataProvider.refresh();
      decorationProvider.fireChange();
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

  // 註冊指令：切換目錄分組 (支援做法 A：固定寬度 Codicon 佔位)
  const toggleGroupByDirectory = async () => {
    const config = getExtensionConfig();
    await setGroupByDirectory(!config.groupByDirectory);
    treeDataProvider.refresh();
  };
  context.subscriptions.push(
    vscode.commands.registerCommand('codeColorfulRecentFiles.toggleGroupByDirectory', toggleGroupByDirectory),
    vscode.commands.registerCommand('codeColorfulRecentFiles.toggleGroupByDirectoryOn', toggleGroupByDirectory),
    vscode.commands.registerCommand('codeColorfulRecentFiles.toggleGroupByDirectoryOff', toggleGroupByDirectory)
  );

  // 註冊指令：切換配色方案 (支援做法 B：尾端狀態標籤)
  const toggleColorScheme = async () => {
    const config = getExtensionConfig();
    const nextScheme = config.colorScheme === 'rankSpectrum' ? 'timeBucket' : 'rankSpectrum';
    await setColorScheme(nextScheme);
    treeDataProvider.refresh();
    decorationProvider.fireChange();
  };
  context.subscriptions.push(
    vscode.commands.registerCommand('codeColorfulRecentFiles.toggleColorScheme', toggleColorScheme),
    vscode.commands.registerCommand('codeColorfulRecentFiles.toggleColorSchemeRank', toggleColorScheme),
    vscode.commands.registerCommand('codeColorfulRecentFiles.toggleColorSchemeBucket', toggleColorScheme)
  );

  // 註冊指令：切換色彩小圓點圖示 (支援做法 C：尾端簡潔勾選符號)
  const toggleShowColorDotIcon = async () => {
    const config = getExtensionConfig();
    await setShowColorDotIcon(!config.showColorDotIcon);
    treeDataProvider.refresh();
  };
  context.subscriptions.push(
    vscode.commands.registerCommand('codeColorfulRecentFiles.toggleShowColorDotIcon', toggleShowColorDotIcon),
    vscode.commands.registerCommand('codeColorfulRecentFiles.toggleShowColorDotIconOn', toggleShowColorDotIcon),
    vscode.commands.registerCommand('codeColorfulRecentFiles.toggleShowColorDotIconOff', toggleShowColorDotIcon)
  );

  // 註冊指令：切換原生總管裝飾 (支援做法 D：VS Code 原生 toggled 對照組)
  context.subscriptions.push(
    vscode.commands.registerCommand('codeColorfulRecentFiles.toggleStyleNativeExplorer', async () => {
      const config = getExtensionConfig();
      await setStyleNativeExplorer(!config.styleNativeExplorer);
      decorationProvider.fireChange();
    })
  );

  // 註冊指令：切換熱度時間基準 (支援做法 E：動態切換動作語意)
  const toggleHighlightMode = async () => {
    const config = getExtensionConfig();
    const nextMode = config.highlightMode === 'lastAccess' ? 'lastModified' : 'lastAccess';
    await setHighlightMode(nextMode);
    treeDataProvider.refresh();
    decorationProvider.fireChange();
  };
  context.subscriptions.push(
    vscode.commands.registerCommand('codeColorfulRecentFiles.toggleHighlightMode', toggleHighlightMode),
    vscode.commands.registerCommand('codeColorfulRecentFiles.toggleHighlightModeToModified', toggleHighlightMode),
    vscode.commands.registerCommand('codeColorfulRecentFiles.toggleHighlightModeToAccess', toggleHighlightMode)
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

  // 註冊指令：開啟檔案 (主動更新時間記錄並將該檔案及所屬資料夾立刻置頂)
  context.subscriptions.push(
    vscode.commands.registerCommand('codeColorfulRecentFiles.openFile', async (uri: vscode.Uri) => {
      if (uri) {
        await manager.touchFile(uri.fsPath);
        await vscode.commands.executeCommand('vscode.open', uri);
      }
    })
  );

  logInfo('Colorful Recent Files extension activated successfully.');
}

export function deactivate(): void {
  // 資源由 context.subscriptions 自動處置
}
