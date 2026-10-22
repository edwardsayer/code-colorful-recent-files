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
* `codeColorfulRecentFiles.colorScheme`：配色模式，支援連續彩虹順位色譜 `rankSpectrum` 或時間區間階梯 `timeBucket`（預設：`rankSpectrum`）。
* `codeColorfulRecentFiles.showColorDotIcon`：是否在樹狀檢視中改以色彩小圓點取代檔案圖示（預設：`false`，維持顯示原生檔案圖示）。
* `codeColorfulRecentFiles.styleNativeExplorer`：是否將色彩裝飾與右方標注同時套用至 VS Code 原生檔案總管（預設：`false`）。
* `codeColorfulRecentFiles.maxRecentFiles`：工作區內保留的最大最近檔案筆數（預設：`50`）。
* `codeColorfulRecentFiles.highlightMode`：時間熱度計算基準（`lastAccess` 或 `lastModified`，預設：`lastAccess`）。

## 自訂色彩與跨主題 Patch (Color Customization)

本套件原生註冊 6 個熱度色彩 Token（`colorfulRecentFiles.heat1` ~ `heat6`）。預設會自動依據您的主題在深色底（2026 Dark 舒適色）與淺色底（2026 Light 高對比色）之間自適應。

若您使用的是第三方主題，且希望手動覆寫為最舒服的色彩，可直接在 VS Code 的 `settings.json` 中自訂真實 RGB Hex：

```json
"workbench.colorCustomizations": {
  "colorfulRecentFiles.heat1": "#EF8773",
  "colorfulRecentFiles.heat2": "#CD861A",
  "colorfulRecentFiles.heat3": "#E0B97F",
  "colorfulRecentFiles.heat4": "#86CF86",
  "colorfulRecentFiles.heat5": "#57A3F8",
  "colorfulRecentFiles.heat6": "#AD80D7"
}
```

（亮色主題建議值：`heat1`: `#AD0707`, `heat2`: `#D18616`, `heat3`: `#667309`, `heat4`: `#388A34`, `heat5`: `#1A5CFF`, `heat6`: `#652D90`）

## 貢獻指令

* `最近檔案：重新整理` (`codeColorfulRecentFiles.refresh`)
* `最近檔案：依目錄分組` (`codeColorfulRecentFiles.toggleGroupByDirectory`)
* `最近檔案：清除歷史紀錄` (`codeColorfulRecentFiles.clearHistory`)
* `最近檔案：從歷史中移除` (`codeColorfulRecentFiles.removeItem`)

## 授權條款

[MIT](LICENSE)
