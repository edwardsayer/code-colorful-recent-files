# 彩色最近檔案 (Colorful Recent Files)

語言：[English](README.md) | **繁體中文**

專為 VS Code 設計的最近檔案導覽擴充套件。在獨立的活動列（Activity Bar）中以樹狀結構呈現最近開啟與編輯的檔案，支援一鍵目錄分組，並透過原生色彩與徽章標記檔案最後活動的時間熱度。

![Icon](assets/icon.svg)

## 核心功能

- 🕒 **自動追蹤活動記錄**：即時感應用戶切換編輯器、開啟檔案以及編輯／存檔操作。
- 📁 **依目錄分組切換**：在面板右上角選單一鍵切換「時間順序扁平清單」與「階層式目錄樹狀分組」（選單內建原生 Checked ✔ 核取狀態標示）。
- 🎨 **依時間色彩標記 (Heatmap)**：結合 VS Code 原生 `FileDecoration`，根據時間距離套用標準主題色：
  - **最新熱門 (< 15 分鐘)**：`charts.green`（鮮綠色）搭配 `●` 徽章
  - **本日近期 (< 2 小時)**：`charts.yellow`（亮黃色）搭配 `1h` 徽章
  - **本日稍早 (< 24 小時)**：`charts.orange`（暖橘色）搭配 `1d` 徽章
  - **更久以前**：一般中性次要文字顏色
- ⚡ **Local-First 本機優先**：歷史記錄直接持久化於 `workspaceState`，零外部依賴、無任何遠端網路請求。

## 設定選項

本擴充套件提供下列設定：

* `codeColorfulRecentFiles.groupByDirectory`：是否在樹狀檢視中依上層目錄分組（預設：`false`）。
* `codeColorfulRecentFiles.maxRecentFiles`：工作區內保留的最大最近檔案筆數（預設：`50`）。
* `codeColorfulRecentFiles.highlightMode`：時間熱度計算基準（`lastAccess` 或 `lastModified`，預設：`lastAccess`）。

## 貢獻指令

* `最近檔案：重新整理` (`codeColorfulRecentFiles.refresh`)
* `最近檔案：依目錄分組` (`codeColorfulRecentFiles.toggleGroupByDirectory`)
* `最近檔案：清除歷史紀錄` (`codeColorfulRecentFiles.clearHistory`)
* `最近檔案：從歷史中移除` (`codeColorfulRecentFiles.removeItem`)

## 授權條款

[MIT](LICENSE)
