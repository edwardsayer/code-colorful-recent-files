# AGENTS.md — code-colorful-recent-files

## Overview

`code-colorful-recent-files`（extension id `edwardsayer.code-colorful-recent-files`）：VS Code 的彩色最近檔案總管。在專屬 Activity Bar 容器中呈現當前工作區最近開啟或編輯過的檔案，支援扁平／目錄分組切換與原生時間熱度色彩標記。

產品願景與 Stage 計畫見私有規劃：
- `dev/planning/TODO.md`（唯一 canonical Stage 主控）
- `dev/specs/recent-files-design.md`（系統規格書）

> `dev/` 實體位於工作區私有 repo `dev/code-colorful-recent-files/`，本專案內為 NTFS junction；管理用 `node ../tools/dev-link.mjs`。**禁用 `rm -rf <project>/dev`**。

## Architecture (`src/`)

- `extension.ts`：擴充套件進入點。註冊 `RecentFilesManager`、`RecentTreeDataProvider`、`RecentFileDecorationProvider` 與指令，並加入 `context.subscriptions`。
- `recentFilesManager.ts`：核心狀態維護與事件追蹤。監聽 `onDidOpenTextDocument`、`onDidChangeTextDocument`、`onDidChangeActiveTextEditor` 與 `onDidSaveTextDocument`；持久化於 `context.workspaceState`。
- `recentTreeDataProvider.ts`：實作 `vscode.TreeDataProvider`。依據 `groupByDirectory` 設定呈現扁平清單或樹狀目錄分組。
- `recentFileDecorationProvider.ts`：實作 `vscode.FileDecorationProvider`。計算時間間隔並指派 `charts.green`、`charts.yellow`、`charts.orange` 等主題色與 Badge。
- `config.ts`：設定讀寫與正規化。
- `types.ts`：共用資料型別。
- `util/time.ts`：時間差計算、相對時間文字與熱度級距判定（純邏輯，可單元測試）。
- `util/log.ts`：`vscode.LogOutputChannel` 封裝。

## 關鍵技術決策

1. **Local-First 與狀態持久化**：使用 `workspaceState` 保存紀錄，不依賴外部服務或檔案。
2. **原生 UI 整合**：選單勾選使用 VS Code 宣告式 `toggled` 屬性（在 `package.json` 的 `menus["view/title"]` 宣告），遵循原生 UI 規範。
3. **原生色彩裝飾**：使用 `vscode.window.registerFileDecorationProvider`，搭配 VS Code 內建 `ThemeColor`（`charts.green` 等），確保在深色、淺色與高對比主題中視覺一致。
4. **資源完整釋放**：所有 listener、provider 與 command 必須納入 `context.subscriptions`。

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
