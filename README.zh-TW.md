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

## 視覺風格：原生檔案圖示 vs 色彩小圓點 (Color Dot)

本套件提供兩種視覺風格，兼顧沉浸體驗與熱度辨識：

1. **原生檔案圖示模式（預設）**：
   維持 VS Code 原生 File Icon Theme（如 Seti、Material 等），文字與右方標注使用 VS Code 原生 `FileDecoration`（`#序號 • 時間`，例如 `#1 • 剛剛`）。
2. **色彩小圓點模式（Color Dot Icon）**：
   在樹狀清單中將檔案圖示替換為精緻的向量色彩小圓點。小圓點採用平滑連續線性插值（Piecewise Linear Interpolation），並會依當前主題自動自適應（深色底使用 2026 Dark 柔和色階；亮色底使用 2026 Light 高對比色階）。

### 如何啟用色彩小圓點模式？

- **方法一：透過 VS Code 視覺化設定介面 (GUI)**
  1. 按下快捷鍵 `Ctrl + ,` (macOS 為 `Cmd + ,`) 開啟設定。
  2. 於搜尋列輸入：`Colorful Recent Files: Show Color Dot Icon`。
  3. 將「**Show Color Dot Icon**」核取方塊勾選即可即時生效。

- **方法二：透過 `settings.json` 設定檔**
  開啟使用者或工作區的 `settings.json`，加入以下配置：
  ```json
  "codeColorfulRecentFiles.showColorDotIcon": true
  ```

---

## 設定選項 (Configuration)

您可以在 VS Code 的 `settings.json` 中調整以下設定：

| 設定項目 | 型別 | 預設值 | 說明 |
| :--- | :--- | :--- | :--- |
| `codeColorfulRecentFiles.showColorDotIcon` | `boolean` | `false` | **色彩小圓點開關**：是否以色彩向量圓點取代預設檔案圖示。 |
| `codeColorfulRecentFiles.groupByDirectory` | `boolean` | `false` | **依目錄分組**：在樹狀檢視中依上層目錄階層呈現最近檔案。 |
| `codeColorfulRecentFiles.colorScheme` | `string` | `"rankSpectrum"` | **色彩方案**：`"rankSpectrum"`（彩虹順位連續光譜）或 `"timeBucket"`（時間階梯分級）。 |
| `codeColorfulRecentFiles.styleNativeExplorer` | `boolean` | `false` | **原生總管裝飾**：是否將色彩裝飾與標注同時套用至 VS Code 原生檔案總管。預設關閉以維持原生總管清爽。 |
| `codeColorfulRecentFiles.maxRecentFiles` | `number` | `50` | **最大追蹤筆數**：工作區內保留的最大最近檔案筆數（5 ~ 500）。 |
| `codeColorfulRecentFiles.highlightMode` | `string` | `"lastAccess"` | **熱度時間基準**：`"lastAccess"`（切換/存取時間）或 `"lastModified"`（編輯/儲存時間）。 |

---

## 自訂色彩與跨主題 Patch (Color Customization)

本套件原生註冊 6 個熱度色彩 Token（`colorfulRecentFiles.heat1` ~ `heat6`），預設綁定經典 `charts.*` 系列，並於官方 2026 Dark 與 2026 Light 深度調校。

若您使用的是第三方主題，且希望手動覆寫為最舒服的色彩，可直接在 VS Code 的 `settings.json` 中的 `workbench.colorCustomizations` 指定真實 RGB Hex 色碼：

### 🌙 深色主題推薦舒適 Patch (2026 Dark 校色)
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

### ☀️ 亮色主題推薦高對比 Patch (2026 Light 校色)
```json
"workbench.colorCustomizations": {
  "colorfulRecentFiles.heat1": "#AD0707",
  "colorfulRecentFiles.heat2": "#D18616",
  "colorfulRecentFiles.heat3": "#667309",
  "colorfulRecentFiles.heat4": "#388A34",
  "colorfulRecentFiles.heat5": "#1A5CFF",
  "colorfulRecentFiles.heat6": "#652D90"
}
```

## 貢獻指令

* `最近檔案：重新整理` (`codeColorfulRecentFiles.refresh`)
* `最近檔案：依目錄分組` (`codeColorfulRecentFiles.toggleGroupByDirectory`)
* `最近檔案：清除歷史紀錄` (`codeColorfulRecentFiles.clearHistory`)
* `最近檔案：從歷史中移除` (`codeColorfulRecentFiles.removeItem`)

## 授權條款

[MIT](LICENSE)
