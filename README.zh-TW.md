# 彩色最近檔案：垂直分頁與歷史紀錄 (Colorful Recent Files: Vertical Tabs & History)
語言：[English](README.md) | **繁體中文**

專為 VS Code 設計的最近檔案導覽擴充套件。在獨立的活動列（Activity Bar）中以樹狀結構呈現最近開啟與編輯的檔案，支援一鍵目錄分組，並透過原生色彩與徽章標記檔案最後活動的時間熱度。

<img src="assets/icon.png" alt="Colorful Recent Files icon" width="128" />

## 核心功能

- 🕒 **自動追蹤活動記錄**：即時感應用戶切換編輯器、開啟檔案以及編輯／存檔操作。
- 📁 **三種分組模式（平鋪／目錄／副檔名）**：
  - **平鋪（Flat）**：依時間順序直觀排列。
  - **依目錄分組（Directory）**：依上層目錄階層呈現樹狀分組。
  - **依類型分組（Type / Extension）**：依檔案副檔名或視圖類型歸類（如 `TS`, `JSON`, `MD`, `OTHER`），以資料夾呈現並自動轉為全大寫。
- 📑 **同步開啟分頁（Vertical Tabs 模式）**：
  - 開啟時**僅呈現目前編輯器開啟的分頁**，即時作為垂直分頁清單使用。
  - 當分頁在編輯器中關閉或在樹狀清單中點擊關閉按鈕時，自動從清單隱藏並連動關閉分頁；**注意：此操作純屬視圖過濾，不會抹除底層持久化存取歷史**，關閉同步時即可完整還原全量歷史。
- 📌 **可分組 Pin 與拖曳排序**：
  - 分組列右方可 Pin 任一資料夾或類型分組（或使用右鍵選單「Pin 此分組」）；已 Pin 的分組固定在最上方並顯示 📌 標記。
  - **已 Pin 分組**採手動排序：把已 Pin 的分組拖到另一個已 Pin 分組上即可調整位置；未 Pin 的分組永遠不會被拖到已 Pin 分組之上。
  - **未 Pin 分組**一律接在已 Pin 區塊之後，依最近活動時間排序（跟隨「時間基準」設定）。
- 🎨 **依時間色彩標記 (Heatmap)**：結合 VS Code 原生 `FileDecoration`，根據時間距離套用標準主題色：
  - **最新熱門 (< 15 分鐘)**：`heat4`（鮮綠色）搭配 `●` 徽章
  - **本日近期 (< 2 小時)**：`heat3`（亮黃色）搭配 `1h` 徽章
  - **本日稍早 (< 24 小時)**：`heat2`（暖橘色）搭配 `1d` 徽章
  - **更久以前**：一般中性次要文字顏色
- 🖱️ **可拖曳檔案出去**：把任何檔案拖到原生 Explorer、編輯器，或其他接受 `text/uri-list` 的擴充套件（例如 **Folder Spaces**）。傳遞的是標準 `file:` URI，落點端拿到的是真實檔案系統路徑。
- ⚡ **Local-First 本機優先**：歷史記錄直接持久化於 `workspaceState`，零外部依賴、無任何遠端網路請求。

## 視覺風格：原生檔案圖示 vs 色彩小圓點 (Color Dot)

本套件提供兩種視覺風格，兼顧沉浸體驗與熱度辨識：

1. **原生檔案圖示模式（預設）**：
   維持 VS Code 原生 File Icon Theme（如 Seti、Material 等）。檔名右側只顯示相對時間（例如 `剛剛`），順位序號由 VS Code 原生 `FileDecoration` 的 badge 呈現在**列的最右側**，兩者不重複。
   > 註：開啟「Style Native Explorer」後，本套件也會為原生 Explorer 與 Editor tab 上色；**那些位置只上色、不顯示序號**，以免與檔案診斷（問題計數）、Git 裝飾等原生標記混在一起。
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

## 檢視選單讀法

檢視標題列的 `...` 選單有兩種表示法：

- **多選項項目**（`名稱: <emoji> 目前值 ➜ 下一個值`）：**有 emoji 的是目前值**，箭頭後面是**點擊後會切換到的值**（最後一項會循環回第一項），下一個值不加 emoji。
  - `分組模式: ✖️ 無 ➜ 類型` → 目前為「無」，點擊後切換為「類型」。
  - 包含：分組模式、色彩方案、時間基準。
- **開關**（`名稱` / `名稱 <emoji>`）：**名稱後面有 emoji 代表已啟用**，沒有 emoji 代表未啟用，點擊即切換。
  - `同步開啟分頁` → 關閉；`同步開啟分頁 ✔️` → 開啟。
  - `色彩小圓點 🟣`、`套用原生檔案總管 🫟` 規則相同。

## 設定選項 (Configuration)

您可以在 VS Code 的 `settings.json` 中調整以下設定：

| 設定項目 | 型別 | 預設值 | 說明 |
| :--- | :--- | :--- | :--- |
| `codeColorfulRecentFiles.groupBy` | `string` | `"none"` | **分組模式**：`"none"` (平鋪清單)、`"directory"` (依目錄階層分組) 或 `"type"` (依大寫副檔名字母分組)。 |
| `codeColorfulRecentFiles.syncWithOpenTabs` | `boolean` | `false` | **同步開啟分頁**：是否僅顯示當前編輯器開啟的分頁（垂直分頁 Vertical Tabs 模式）。 |
| `codeColorfulRecentFiles.showColorDotIcon` | `boolean` | `false` | **色彩小圓點開關**：是否以色彩向量圓點取代預設檔案圖示。 |
| `codeColorfulRecentFiles.groupByDirectory` | `boolean` | `false` | **依目錄分組 (相容舊設定)**：已由 `groupBy` 擴充。 |
| `codeColorfulRecentFiles.colorScheme` | `string` | `"rankSpectrum"` | **色彩方案**：`"rankSpectrum"` (彩虹順位連續光譜)、`"timeBucket"` (時間階梯分級) 或 `"plainText"` (純文字中性模式，文字/序號/檔案數不著色，不影響彩色圓點)。 |
| `codeColorfulRecentFiles.styleNativeExplorer` | `boolean` | `false` | **原生總管裝飾**：是否將色彩裝飾與標注同時套用至 VS Code 原生檔案總管。預設關閉以維持原生總管清爽。 |
| `codeColorfulRecentFiles.maxRecentFiles` | `number` | `50` | **最大追蹤筆數**：工作區內保留的最大最近檔案筆數（5 ~ 500）。 |
| `codeColorfulRecentFiles.highlightMode` | `string` | `"lastAccess"` | **熱度時間基準**：`"lastAccess"`（切換/存取時間）或 `"lastModified"`（編輯/儲存時間）。 |

---

## 自訂色彩與跨主題 Patch (Color Customization)

本套件原生註冊 6 個熱度色彩 Token（`colorfulRecentFiles.heat1` ~ `heat6`），預設為與 Color Theme 脫鉤的固定色票，並於官方 2026 Dark 與 2026 Light 深度調校。

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
