# AGENTS.md — code-colorful-recent-files

## Overview

`code-colorful-recent-files`（extension id `edwardsayer.code-colorful-recent-files`）：VS Code 的彩色最近檔案總管（Marketplace 顯示名稱：Colorful Recent Files: Vertical Tabs & History）。在專屬 Activity Bar 容器中呈現當前工作區最近開啟或編輯過的檔案，支援扁平／目錄分組切換與原生時間熱度色彩標記。

產品願景與 Stage 計畫見私有規劃：
- `dev/planning/TODO.md`（唯一 canonical Stage 主控）
- `dev/specs/recent-files-design.md`（系統規格書）

> `dev/` 實體位於工作區私有 repo `dev/code-colorful-recent-files/`，本專案內為 NTFS junction；管理用 `node ../tools/dev-link.mjs`。**禁用 `rm -rf <project>/dev`**。

## Architecture (`src/`)

- `extension.ts`：擴充套件進入點。註冊 `RecentFilesManager`、`RecentTreeDataProvider`、`RecentFileDecorationProvider` 與指令，並加入 `context.subscriptions`。啟動時以 `decideHeatTokensReady()`（`package.json` mtime 對比 Extension Host 啟動時間）判斷 heat token 是否已被 VS Code 套用；未就緒時走 `FALLBACK_COLOR_IDS`。
- `contextMenu.ts`：`view/item/context` 右鍵選單與 inline 指令實作（Pin/Unpin 分組、關閉／移除群組、轉交內建分頁與檔案命令）。
- `recentFilesManager.ts`：核心狀態維護與事件追蹤。監聽 `onDidOpenTextDocument`、`onDidChangeTextDocument`、`onDidChangeActiveTextEditor` 與 `onDidSaveTextDocument`；持久化於 `context.workspaceState`。
- `recentTreeDataProvider.ts`：實作 `vscode.TreeDataProvider`。依 `groupBy` 設定呈現扁平清單或 Folder/Type 分組樹，分組排序交由 `util/groupSort.ts`。
- `recentFileDecorationProvider.ts`：實作 `vscode.FileDecorationProvider`。計算時間間隔並指派本套件貢獻的 `colorfulRecentFiles.heat1~6` 色彩 token 與 Badge。
- `util/groupSort.ts`：分組排序純邏輯（已 Pin 置頂 + 手動順序 + 未 Pin 依最近活動時間），可單元測試。
- `config.ts`：設定讀寫與正規化。
- `types.ts`：共用資料型別。
- `util/time.ts`：時間差計算、相對時間文字與熱度級距判定（純邏輯，可單元測試）。
- `util/log.ts`：`vscode.LogOutputChannel` 封裝。

## 關鍵技術決策

1. **Local-First 與狀態持久化**：使用 `workspaceState` 保存紀錄，不依賴外部服務或檔案。
2. **原生 UI 整合**：選單勾選使用 VS Code 宣告式 `toggled` 屬性（在 `package.json` 的 `menus["view/title"]` 宣告），遵循原生 UI 規範。
3. **原生色彩裝飾**：使用 `vscode.window.registerFileDecorationProvider`，搭配本套件貢獻的 `colorfulRecentFiles.heat1~6` 色彩 token（固定預設色票，與 Color Theme 脫鉤，使用者可用 `workbench.colorCustomizations` 覆寫），確保在深色、淺色與高對比主題中視覺一致。**注意**：VS Code 只在**視窗啟動**時把已安裝擴充套件的 `contributes.colors` 納入主題 CSS；執行期安裝（含「移除 → reload → 重裝」）不會重建這些變數，`ThemeColor('colorfulRecentFiles.heat*')` 無法解析，FileDecoration 會**完全不上色**。此時改用 `FALLBACK_COLOR_IDS`，reload 或切換 Color Theme 後改回 heat token。

   **判斷依據不可用 `globalState` 版本旗標**：舊做法記「這個版本啟動過」，在「安裝 → 移除 → reload → 重裝」流程下旗標會殘留而誤判為已就緒，導致不上色（已實測重現）。現以 `decideHeatTokensReady(installedAtMs, hostStartMs)` 比較「`package.json` mtime」與「Extension Host 啟動時間」，安裝晚於啟動即視為 token 未就緒；誤判方向刻意偏向 fallback（寧可色票略有差異，也不要完全不上色）。

   **地雷：不可使用 `charts.orange` 當 fallback**。VSCodium（及 Code-OSS 系）將 `charts.orange` 定義為 `rgba(234, 92, 0, 0.33)`（33% 不透明度，原本是給圖表填色用），當成文字前景色時幾乎看不見，會讓「首載沒上色」重現。橘色階一律用跨發行版皆不透明的 `symbolIcon.classForeground`；`charts.red/yellow/green/blue/purple` 在 VS Code 與 VSCodium 皆為不透明，可安全使用。`tests/unit/color.test.ts` 有回歸測試守住此限制。
4. **資源完整釋放**：所有 listener、provider 與 command 必須納入 `context.subscriptions`。
5. **分組排序由 Pin 驅動**：已 Pin 的 Folder/Type 分組置頂並可手動拖曳；未 Pin 分組接續其後，依 Time Metric 的最近活動時間排序。`folderSortOrder`（latest/name/manual）設定已移除，排序狀態存於 `workspaceState` 的 `codeColorfulRecentFiles.pinnedGroupOrder`。
6. **inline 動作只在 hover 顯示**：`view/item/context` 的 `group: "inline"` 按鈕無法常駐顯示（VS Code 原生行為，無 API 可改）。因此已 Pin 的常駐視覺提示用節點 `description` 的 📌；右側 `$(pin)`／`$(pinned)` 切換鈕為 hover 顯示。

## 指令與驗證

```bash
npm run typecheck       # tsc --noEmit
npm run test:unit       # vitest run
npm run build           # esbuild → dist/extension.js
npm run check:project   # 專案健康度檢查
npm run check           # 全部檢查
npm run package:vsix    # 打包產出 vsix
```

## Definition of Done

- `npm run check` 全綠（typecheck + unit + build + check:project）。
- 支援目錄分組與扁平清單即時切換。
- 最近檔案時間熱度色彩正確賦予。
