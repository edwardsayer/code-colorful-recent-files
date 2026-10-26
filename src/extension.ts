import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  getExtensionConfig,
  setColorScheme,
  setGroupBy,
  setHighlightMode,
  setShowColorDotIcon,
  setStyleNativeExplorer,
  setSyncWithOpenTabs,
} from './config';
import { registerContextMenuCommands } from './contextMenu';
import { RecentFileDecorationProvider } from './recentFileDecorationProvider';
import { RecentFilesManager } from './recentFilesManager';
import { RecentTreeDataProvider } from './recentTreeDataProvider';
import { RecentTreeDragAndDropController } from './treeDragAndDrop';
import { RECENT_FOLDER_SCHEME, RECENT_SCHEME, RecentFileElement } from './types';
import { decideHeatTokensReady, setHeatTokensReady } from './util/color';
import { initLogger, logInfo } from './util/log';
import { DummyFileSystemProvider } from './util/virtualFs';

/**
 * 判斷本次視窗的 heat token 是否已可用。
 *
 * 以「擴充套件安裝時間（package.json mtime）」與「Extension Host 啟動時間」比較：
 * 安裝時間晚於啟動時間（含容差）＝ 本次啟動後才安裝 → token 尚未套用 → 使用 fallback。
 * 無法取得任一時間時，保守回傳 false（走 fallback，保證至少有顏色）。
 */
function resolveHeatTokensReady(context: vscode.ExtensionContext): boolean {
  try {
    const stat = fs.statSync(path.join(context.extension.extensionPath, 'package.json'));
    const installedAtMs = stat.mtimeMs;
    const hostStartMs = Date.now() - process.uptime() * 1000;
    const ready = decideHeatTokensReady(installedAtMs, hostStartMs);
    logInfo(
      `heat tokens ready=${ready} (installedAt=${new Date(installedAtMs).toISOString()}, hostStart=${new Date(hostStartMs).toISOString()})`
    );
    return ready;
  } catch (err) {
    logInfo('Failed to determine heat token availability; falling back to built-in colors.');
    return false;
  }
}

export function activate(context: vscode.ExtensionContext): void {
  initLogger(context);
  logInfo('Activating Colorful Recent Files extension...');

  // VS Code 只在視窗啟動時把已安裝擴充套件的 `contributes.colors` 納入主題 CSS。
  // 若本套件是在本次視窗啟動後才（重新）安裝，heat token 尚未存在於 CSS，
  // 必須暫時改用內建且不透明的 token，否則 FileDecoration 會完全不上色。
  // 判斷依據：安裝時間（package.json mtime）是否早於 Extension Host 啟動時間。
  setHeatTokensReady(resolveHeatTokensReady(context));

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
  // `canSelectMany` 必須開啟，否則 `dragMimeTypes` 的多檔序列化（`\r\n` 分隔）
  // 與 `util/dragPaths` 的去重邏輯在 UI 上無法觸發（永遠只有單選）。
  const treeView = vscode.window.createTreeView('codeColorfulRecentFiles.recentView', {
    treeDataProvider,
    dragAndDropController: dndController,
    showCollapseAll: true,
    canSelectMany: true,
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
        // 設定可能影響排序與截斷（如 maxRecentFiles），必須先作廢快取，
        // 否則畫面會沿用舊設定直到 reload 或下一次資料事件。
        manager.invalidateCache();
        treeDataProvider.refresh();
        decorationProvider.fireChange();
      }
    })
  );

  // 監聽顏色主題變更，確保切換深色/淺色主題時小圓點與標記能即時適應
  context.subscriptions.push(
    vscode.window.onDidChangeActiveColorTheme(() => {
      setHeatTokensReady(true);
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

  // 註冊指令：選單項目。每個多選項各狀態一個指令 ID（供 package.json 依目前值顯示對應標題），行為皆為循環至下一個值。
  const P = 'codeColorfulRecentFiles';
  const register = (ids: string[], handler: () => Promise<void>) => {
    for (const id of ids) {
      context.subscriptions.push(vscode.commands.registerCommand(`${P}.${id}`, handler));
    }
  };

  // 分組模式：None(預設) → Type → Directory
  register(['cycleGroupByNone', 'cycleGroupByType', 'cycleGroupByDirectory'], async () => {
    const config = getExtensionConfig();
    const nextMode = config.groupBy === 'none' ? 'type' : (config.groupBy === 'type' ? 'directory' : 'none');
    await setGroupBy(nextMode);
    treeDataProvider.refresh();
  });

  // 配色方案：rankSpectrum(預設) → timeBucket → plainText
  register(['cycleColorSchemeRank', 'cycleColorSchemeBucket', 'cycleColorSchemePlainText'], async () => {
    const config = getExtensionConfig();
    const nextScheme = config.colorScheme === 'rankSpectrum'
      ? 'timeBucket'
      : (config.colorScheme === 'timeBucket' ? 'plainText' : 'rankSpectrum');
    await setColorScheme(nextScheme);
    treeDataProvider.refresh();
    decorationProvider.fireChange();
  });

  // 時間基準：lastAccess(預設) → lastModified
  register(['cycleHighlightModeAccess', 'cycleHighlightModeModified'], async () => {
    const config = getExtensionConfig();
    await setHighlightMode(config.highlightMode === 'lastAccess' ? 'lastModified' : 'lastAccess');
    treeDataProvider.refresh();
    decorationProvider.fireChange();
  });

  // 雙態 Toggle：On = 目前未啟用時顯示的項目，Off = 目前已啟用時顯示的項目
  register(['toggleSyncWithOpenTabsOn', 'toggleSyncWithOpenTabsOff'], async () => {
    await setSyncWithOpenTabs(!getExtensionConfig().syncWithOpenTabs);
    treeDataProvider.refresh();
    decorationProvider.fireChange();
  });
  register(['toggleShowColorDotIconOn', 'toggleShowColorDotIconOff'], async () => {
    await setShowColorDotIcon(!getExtensionConfig().showColorDotIcon);
    treeDataProvider.refresh();
  });
  register(['toggleStyleNativeExplorerOn', 'toggleStyleNativeExplorerOff'], async () => {
    await setStyleNativeExplorer(!getExtensionConfig().styleNativeExplorer);
    decorationProvider.fireChange();
  });

  // 註冊指令：清除全部歷史紀錄
  context.subscriptions.push(
    vscode.commands.registerCommand('codeColorfulRecentFiles.clearHistory', async () => {
      const message = vscode.l10n.t('Are you sure you want to clear all recent files history?');
      const actionClear = vscode.l10n.t('Clear');
      const actionCancel = vscode.l10n.t('Cancel');

      const answer = await vscode.window.showWarningMessage(
        message,
        { modal: true },
        actionClear,
        actionCancel
      );

      if (answer === actionClear) {
        await manager.clearAll();
        vscode.window.showInformationMessage(vscode.l10n.t('Recent files history has been cleared.'));
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

  registerContextMenuCommands(context, manager);

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
