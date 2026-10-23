import * as vscode from 'vscode';
import {
  getExtensionConfig,
  setColorScheme,
  setFolderSortOrder,
  setGroupBy,
  setGroupByDirectory,
  setHighlightMode,
  setShowColorDotIcon,
  setStyleNativeExplorer,
  setSyncWithOpenTabs,
} from './config';
import { RecentFileDecorationProvider } from './recentFileDecorationProvider';
import { RecentFilesManager } from './recentFilesManager';
import { RecentTreeDataProvider } from './recentTreeDataProvider';
import { RecentTreeDragAndDropController } from './treeDragAndDrop';
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
  const dndController = new RecentTreeDragAndDropController(manager, () => {
    treeDataProvider.refresh();
  });

  // 註冊 TreeView (含拖曳控制器)
  const treeView = vscode.window.createTreeView('codeColorfulRecentFiles.recentView', {
    treeDataProvider,
    dragAndDropController: dndController,
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

  // 註冊指令：切換分組模式 (平鋪 None / 依目錄 Directory / 依類型 Type)
  const cycleGroupBy = async () => {
    const config = getExtensionConfig();
    const nextMode = config.groupBy === 'none' ? 'directory' : (config.groupBy === 'directory' ? 'type' : 'none');
    await setGroupBy(nextMode);
    treeDataProvider.refresh();
  };
  context.subscriptions.push(
    vscode.commands.registerCommand('codeColorfulRecentFiles.toggleGroupBy', cycleGroupBy),
    vscode.commands.registerCommand('codeColorfulRecentFiles.setGroupByNone', async () => {
      await setGroupBy('none');
      treeDataProvider.refresh();
    }),
    vscode.commands.registerCommand('codeColorfulRecentFiles.setGroupByDirectory', async () => {
      await setGroupBy('directory');
      treeDataProvider.refresh();
    }),
    vscode.commands.registerCommand('codeColorfulRecentFiles.setGroupByType', async () => {
      await setGroupBy('type');
      treeDataProvider.refresh();
    })
  );

  // 註冊指令：切換目錄分組 (向後相容)
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

  // 註冊指令：切換 Sync with Open Tabs (垂直分頁雙向同步)
  const toggleSyncWithOpenTabs = async () => {
    const config = getExtensionConfig();
    await setSyncWithOpenTabs(!config.syncWithOpenTabs);
    treeDataProvider.refresh();
    decorationProvider.fireChange();
  };
  context.subscriptions.push(
    vscode.commands.registerCommand('codeColorfulRecentFiles.toggleSyncWithOpenTabs', toggleSyncWithOpenTabs),
    vscode.commands.registerCommand('codeColorfulRecentFiles.toggleSyncWithOpenTabsOn', toggleSyncWithOpenTabs),
    vscode.commands.registerCommand('codeColorfulRecentFiles.toggleSyncWithOpenTabsOff', toggleSyncWithOpenTabs)
  );

  // 註冊指令：切換資料夾排序模式 (最新 latest / 名稱 name / 手動 manual)
  const cycleFolderSortOrder = async () => {
    const config = getExtensionConfig();
    const nextOrder = config.folderSortOrder === 'latest' ? 'name' : (config.folderSortOrder === 'name' ? 'manual' : 'latest');
    await setFolderSortOrder(nextOrder);
    treeDataProvider.refresh();
  };
  context.subscriptions.push(
    vscode.commands.registerCommand('codeColorfulRecentFiles.toggleFolderSortOrder', cycleFolderSortOrder),
    vscode.commands.registerCommand('codeColorfulRecentFiles.setFolderSortLatest', async () => {
      await setFolderSortOrder('latest');
      treeDataProvider.refresh();
    }),
    vscode.commands.registerCommand('codeColorfulRecentFiles.setFolderSortName', async () => {
      await setFolderSortOrder('name');
      treeDataProvider.refresh();
    }),
    vscode.commands.registerCommand('codeColorfulRecentFiles.setFolderSortManual', async () => {
      await setFolderSortOrder('manual');
      treeDataProvider.refresh();
    })
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

  // 註冊指令：切換原生總管裝飾 (支援尾端方括號標記 [✓])
  const toggleStyleNativeExplorer = async () => {
    const config = getExtensionConfig();
    await setStyleNativeExplorer(!config.styleNativeExplorer);
    decorationProvider.fireChange();
  };
  context.subscriptions.push(
    vscode.commands.registerCommand('codeColorfulRecentFiles.toggleStyleNativeExplorer', toggleStyleNativeExplorer),
    vscode.commands.registerCommand('codeColorfulRecentFiles.toggleStyleNativeExplorerOn', toggleStyleNativeExplorer),
    vscode.commands.registerCommand('codeColorfulRecentFiles.toggleStyleNativeExplorerOff', toggleStyleNativeExplorer)
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

  // 註冊指令：移除單一項目 / 關閉 Tab (Sync 模式下關閉分頁但不抹除歷史)
  context.subscriptions.push(
    vscode.commands.registerCommand('codeColorfulRecentFiles.removeItem', async (element?: RecentFileElement) => {
      if (!element || !element.record) return;
      const config = getExtensionConfig();
      if (config.syncWithOpenTabs) {
        await manager.closeTabForFile(element.record.fsPath);
      } else {
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
