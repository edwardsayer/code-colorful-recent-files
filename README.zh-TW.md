# Colorful Recent Files：垂直分頁與歷史記錄

語言： [English](README.md) | **繁體中文** | [简体中文](README.zh-CN.md)

在專屬的 Activity Bar TreeView 中呈現你最近開啟與編輯過的檔案，支援原生時間熱度裝飾、三種分組模式與垂直分頁模式。

<img src="assets/icon.png" alt="Colorful Recent Files 圖示" width="128" />

![最近檔案清單檢視](assets/screenshots/01-list-view.png)

## 功能

- 🕒 **自動追蹤**：切換、開啟或儲存檔案時自動記錄。歷史存於 `workspaceState`，零網路存取、無外部服務。
- 📑 **垂直分頁（Sync with Open Tabs）**：開啟後檢視**只列出目前已開啟的編輯器分頁**，可當作快速垂直分頁列使用。從檢視關閉分頁也會關閉對應的編輯器分頁；歷史存取記錄會完整保留，關閉同步後重新出現。
- 📁 **三種分組模式**：
  - **Flat（不分組）**——單一最近檔案清單。
  - **Directory（目錄）**——依資料夾路徑分組。
  - **Type（類型）**——依副檔名大寫分組（`TS`、`JSON`、`MD`、`OTHER`）。純數字副檔名依長度分桶：1–3 碼、4–6 碼、7 碼以上。
- 📌 **可 Pin 分組與手動排序**：將滑鼠移到 Folder／Type 分組列上，點擊右側浮現的 inline Pin 按鈕即可釘選。已 Pin 分組會置頂、顯示 📌 標記，並保留可拖曳調整的手動順序。未 Pin 分組一律接續在已 Pin 區塊之後，依最近活動時間排序（跟隨 Time Metric 設定）。
- 🎨 **三種配色方案**：`rankSpectrum`（預設，依序號的平滑彩虹）、`timeBucket`（依時間級距）、`plainText`（中性文字，僅保留彩色圓點）。
- 🖱️ **多選與拖出**：以 `Ctrl`／`Cmd` 或 `Shift` 多選檔案後，拖到編輯器或任何接受 `text/uri-list` 的落點。傳遞的是標準 `file:` URI（每行一個、以 CRLF 分隔、已去重），落點端拿到的是真實檔案系統路徑。
  - **不支援：拖進原生檔案總管（File Explorer）**。這是 VS Code 平台的硬性限制，不是本套件的缺陷——原生 Explorer 在 `dragover` 階段就拒絕任何同視窗的樹狀拖曳（`workbench.desktop.main.js` 內的 `if (o instanceof Lvt) return !1;`），任何 MIME 或 `resourceUri` 調整都無法繞過。要在資料夾間移動檔案，請在 Explorer 內使用剪下／貼上。
- 🗂️ **完整右鍵選單**：Sync 模式下提供與編輯器分頁一致的關閉／釘選／分割／移動動作，另有在 Explorer 中顯示、開終端機、在資料夾中尋找、複製路徑等。
- 🎨 **原生位置裝飾（選用）**：開啟 **Style Native Explorer** 會把同樣的熱度色彩套用到原生 Explorer 樹與編輯器分頁。

## 截圖

| 清單檢視 | 目錄分組 | 類型分組 |
|---|---|---|
| ![清單](assets/screenshots/01-list-view.png) | ![目錄](assets/screenshots/02-group-directory.png) | ![類型](assets/screenshots/03-group-type.png) |

| 已 Pin 分組 | 彩色圓點圖示 | 純文字配色 |
|---|---|---|
| ![已 Pin](assets/screenshots/04-pinned-groups.png) | ![彩色圓點](assets/screenshots/05-color-dot-icons.png) | ![純文字](assets/screenshots/06-plain-text.png) |

| 垂直分頁模式 | 檢視選單 | 右鍵選單 |
|---|---|---|
| ![同步](assets/screenshots/07-sync-open-tabs.png) | ![檢視選單](assets/screenshots/08-view-menu.png) | ![右鍵選單](assets/screenshots/09-context-menu.png) |

## 序號只出現一次

檔案項目的描述**只顯示相對時間**（例如 `just now`、`11m`、`13h`）。序號由列最右側的原生 `FileDecoration` badge 呈現，**不會在文字中重複**。

開啟 **Style Native Explorer** 時，同樣的裝飾也會套用到原生 Explorer 與編輯器分頁，但**只有顏色、不顯示序號 badge**，因此不會與檔案診斷或 Git 狀態標記衝突。

## 視覺風格：原生圖示 vs 彩色圓點

1. **原生檔案圖示（預設）**：保留你的 VS Code 檔案圖示主題（Seti、Material 等）。新舊程度由裝飾顏色與序號 badge 呈現。
2. **彩色圓點圖示**（`showColorDotIcon`）：把檢視中的檔案圖示換成平滑的 SVG 彩色圓點。圓點顏色以分段線性插值計算，並自動適應淺色與深色主題。

啟用方式：

- **設定 UI**：開啟設定（`Ctrl+,`／`Cmd+,`），搜尋 `Colorful Recent Files: Show Color Dot Icon`，勾選即可。
- **`settings.json`**：
  ```json
  "codeColorfulRecentFiles.showColorDotIcon": true
  ```

## 怎麼讀檢視選單

檢視標題的 `...` 選單使用兩種表示法：

- **多選項項目**（`Name: <emoji> 目前值 ➜ 下一個值`）：**emoji 標示目前值**；箭頭後面是**點擊後會切換到的值**，切到最後一項後會回到第一項。
  - `Group by: ✖️ None ➜ Type` → 目前是 *None*，點擊切換為 *Type*。
  - 適用項目：Group by、Color Scheme、Time Metric。
- **開關項目**（`Name`／`Name <emoji>`）：**尾端的 emoji 代表已啟用**，沒有 emoji 代表停用。點擊即切換。
  - `Sync with Open Tabs` → 停用；`Sync with Open Tabs ✔️` → 啟用。
  - `Color Dot Icons 🟣` 與 `Style Native Explorer 🫟` 同理。

## 設定項目

| 設定 | 型別 | 預設 | 說明 |
| :--- | :--- | :--- | :--- |
| `codeColorfulRecentFiles.groupBy` | `string` | `"none"` | 分組模式：`"none"`（不分組）、`"directory"`（目錄）、`"type"`（副檔名大寫分組）。 |
| `codeColorfulRecentFiles.syncWithOpenTabs` | `boolean` | `false` | 只顯示目前已開啟的編輯器分頁（垂直分頁模式）。 |
| `codeColorfulRecentFiles.showColorDotIcon` | `boolean` | `false` | 以彩色圓點取代檔案圖示主題的圖示。 |
| `codeColorfulRecentFiles.colorScheme` | `string` | `"rankSpectrum"` | `"rankSpectrum"`（依序號彩虹）、`"timeBucket"`（依時間級距）、`"plainText"`（中性文字，保留彩色圓點）。 |
| `codeColorfulRecentFiles.styleNativeExplorer` | `boolean` | `false` | 同時裝飾原生 Explorer 樹與編輯器分頁（只有顏色、不含序號 badge）。 |
| `codeColorfulRecentFiles.highlightMode` | `string` | `"lastAccess"` | 時間基準：`"lastAccess"`（開啟／聚焦）或 `"lastModified"`（編輯／儲存）。 |
| `codeColorfulRecentFiles.maxRecentFiles` | `number` | `50` | 歷史保留上限（5–500），變更立即生效。 |
| `codeColorfulRecentFiles.groupByDirectory` | `boolean` | `false` | 舊版目錄分組旗標，已被 `groupBy` 取代。 |

## 色彩自訂

本套件貢獻六個色彩 token（`colorfulRecentFiles.heat1` … `heat6`），預設值固定且與主題脫鉤，因此跨色彩主題仍保持一致。可用 `workbench.colorCustomizations` 覆寫：

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

> **注意**：VS Code 只在視窗啟動時註冊擴充套件貢獻的色彩。若把本套件安裝到已開啟的視窗，該次工作階段會回退到內建色彩，重新載入視窗或切換色彩主題後才會套用 heat token。

## 命令

所有命令都位於 `Recent Files` 分類。下表整理從 UI 可觸及的項目；命令面板（Command Palette）另外直接提供開關與循環命令（`Refresh`、`Clear History`、`Open File`、`Remove from History`，以及 `Group by`／`Color Scheme`／`Time Metric` 的循環與 `Sync with Open Tabs`／`Color Dot Icons`／`Style Native Explorer` 的開關）。

**檢視標題（`...` 選單）**

| 命令 | 作用 |
| :--- | :--- |
| `Refresh` | 重新掃描檔案並更新裝飾。 |
| `Group by: …` | 循環切換分組模式（不分組／目錄／類型）。 |
| `Sync with Open Tabs` | 切換垂直分頁模式。 |
| `Color Scheme: …` | 循環切換配色方案（彩虹／時間級距／純文字）。 |
| `Color Dot Icons` | 切換彩色圓點圖示。 |
| `Style Native Explorer` | 切換是否裝飾原生 Explorer 與編輯器分頁。 |
| `Time Metric: …` | 循環切換時間基準（存取時間／修改時間）。 |
| `Clear History` | 清除此工作區的歷史記錄。 |

**檔案右鍵（Sync 模式）**

`Close Tab` · `Close Other Tabs` · `Close Saved Tabs` · `Close All Tabs` · `Pin / Unpin Tab` · `Open to the Side` · `Split Right` · `Split Down` · `Move to New Window` · `Remove from History` · `Reveal in Explorer` · `Reveal in OS` · `Copy Path` · `Copy Relative Path`

**檔案右鍵（歷史模式）**

`Open to the Side` · `Remove from History` · `Reveal in Explorer` · `Reveal in OS` · `Copy Path` · `Copy Relative Path`

**分組列 inline 按鈕**

`Pin Group`／`Unpin Group`——滑鼠移到 Folder／Type 分組列時出現在右側。釘選與取消釘選**只有 inline 按鈕**，不是右鍵選單項目。

**分組右鍵**

`Close Tabs in Group`（Sync 模式） · `Remove Group from History`（歷史模式） · `Open in Terminal` · `Find in Folder` · `Reveal in Explorer` · `Copy Path`

## 系統需求與限制

- 需要 VS Code **1.85.0** 以上；僅支援桌面版（不支援虛擬工作區）。
- 可在未受信任的工作區運作：本套件只讀寫擴充套件狀態，不執行工作區程式碼。
- 任何擴充套件都**無法**把檔案拖**進**原生 File Explorer（原因見上）。

## 授權

[MIT](LICENSE)
