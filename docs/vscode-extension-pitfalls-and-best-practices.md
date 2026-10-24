# VS Code 擴充套件開發陷阱與最佳實務指南 (Pitfalls & Best Practices)

本文件歸納整理在開發 VS Code 擴充套件（特別是涉及 TreeView、FileDecoration、選單系統、手動排序與分頁連動）過程中所遭遇的真實技術陷阱、核心限制與經過驗證的最佳實務解法。

---

## 目錄

- [一、選單系統與 Submenu 陷阱](#一選單系統與-submenu-陷阱)
  - [1.1 第三方選單 Checkbox 遭 VS Code 強制隱藏](#11-第三方選單-checkbox-遭-vs-code-強制隱藏)
  - [1.2 Submenu 標籤無法透過 API 動態改變](#12-submenu-標籤無法透過-api-動態改變)
  - [1.3 前綴符號推擠 vs 尾端標籤法（排版對齊陷阱）](#13-前綴符號推擠-vs-尾端標籤法排版對齊陷阱)
  - [1.4 選單 Hover Hint (Tooltip) 的支援範圍與限制](#14-選單-hover-hint-tooltip-的支援範圍與限制)
- [二、視覺標注與 FileDecoration 陷阱](#二視覺標注與-filedecoration-陷阱)
  - [2.1 FileDecoration.badge 嚴格字元數限制（最致命陷阱）](#21-filedecorationbadge-嚴格字元數限制最致命陷阱)
  - [2.2 原生 Explorer 樣式污染與 URI Scheme 隔離](#22-原生-explorer-樣式污染與-uri-scheme-隔離)
  - [2.3 雙軌視覺（File Icon Theme vs 色彩插值向量圓點）](#23-雙軌視覺file-icon-theme-vs-色彩插值向量圓點)
- [三、資料模型與排序穩定性陷阱](#三資料模型與排序穩定性陷阱)
  - [3.1 手動拖曳排序 (Manual Sort) 的時間漂移陷阱](#31-手動拖曳排序-manual-sort-的時間漂移陷阱)
  - [3.2 垂直分頁同步模式 (Sync with Open Tabs) 的生命週期與歷史保全](#32-垂直分頁同步模式-sync-with-open-tabs-的生命週期與歷史保全)
- [四、原生 TreeView vs WebviewView 架構抉擇](#四原生-treeview-vs-webviewview-架構抉擇)

---

## 一、選單系統與 Submenu 陷阱

### 1.1 第三方選單 Checkbox 遭 VS Code 強制隱藏

- **陷阱現象**：
  在 `package.json` 的 `menus` 項目中配置官方規格的 `"toggled": "config.myExt.enabled"`，但在視圖標題列的更多選單（`view/title`）或二級子選單（`submenus`）中，**完全看不到打勾（Checked）標記**。
- **根因分析**：
  VS Code 核心渲染層（Renderer CSS）對大部分第三方擴充套件的自訂下拉選單強制套用了 `.menu-item-check { visibility: hidden; }` 或 `display: none`。官方目前僅對核心內建編輯器選單或少數白名單開放打勾欄。
- **最佳實務解法**：
  不要期待原生 `toggled` 能在所有第三方下拉選單中渲染出系統勾選方塊。實務上應採用**成對命令（Paired Commands）＋ 條件切換（`when` clause）**，並在命令標題中以文字符號自帶標記。

---

### 1.2 Submenu 標籤無法透過 API 動態改變

- **陷阱現象**：
  希望在選單頂層呈現當前狀態，例如 `Group by: Type ▶`，展開後可以切換為 `None` 或 `Directory`，但發現 VS Code 沒有任何 API 可以動態修改 `submenus[i].label`。
- **根因分析**：
  Submenu 的 `label` 是靜態編譯於 `package.json` 的，VS Code 的 Extension API 並不提供 `vscode.window.updateSubmenu()` 之類的方法。
- **最佳實務解法**：
  - **方案 A（多重子選單切換）**：在 `submenus` 宣告三個 ID 不同的子選單（`groupBySubmenu.none`、`groupBySubmenu.directory`、`groupBySubmenu.type`），並在 `menus["view/title"]` 透過 `when` 條件動態決定掛載哪一個子選單。
  - **方案 B（靜態頂層分類 ＋ 動態子項目）**：頂層保持固定分類名稱 `Group by ▶`，當前狀態於子選單項目內透過選中符號呈現。

---

### 1.3 前綴符號推擠 vs 尾端標籤法（排版對齊陷阱）

- **陷阱現象**：
  為了呈現打勾，有些擴充套件直接在命令 title 開頭加上 `✔ `（例如 `"title": "✔ Directory"`）。結果當選項被選中時，首字被勾號佔據，**導致後面的文字整行向右位移 2 個字元**，與未選取的項目排在一起時參差不齊。
- **最佳實務解法**：
  採用**尾端簡潔標籤／符號法**：
  ```
  Group by ▶
      None  ✔️
      Directory
      Type
  ```
  讓所有文字在左側**永遠維持絕對齊頭對齊**，勾選或狀態徽章放置於字尾，排版質感最優。

---

### 1.4 選單 Hover Hint (Tooltip) 的支援範圍與限制

- **限制規範**：
  1. **Submenu 頂層項目**：VS Code 官方的 `submenus` 宣告**不支援** `tooltip` 或 `description` 欄位；滑鼠懸停時 VS Code 預設行為是展開子選單，不彈出 tooltip。
  2. **子選單內的 Command 項目**：**支援** Hover Hint！可於 `menus` 掛載時設定 `tooltip`，或使用 command 的 metadata。
  3. **格式限制**：Hover Hint **僅支援純文字 (Plain Text)**，不支持 Markdown 粗體、超連結等語法；建議維持在 10~25 個字以內的簡潔操作說明。

---

## 二、視覺標注與 FileDecoration 陷阱

### 2.1 FileDecoration.badge 嚴格字元數限制（最致命陷阱）

- **陷阱現象**：
  在 `provideFileDecoration` 中回傳色彩與 Badge，發現**所有項目的自訂色彩全部消失**，整個樹狀檢視變成白字或預設顏色。
- **根因分析**：
  **VS Code 的 `FileDecoration.badge` 嚴格限制只能放 1 到 2 個字元！**
  若傳入超過 2 個字元（例如 `"100"`、`"剛剛"`、`"#1"`），VS Code 底層會直接認定該 FileDecoration 非法並**整包作廢丟棄**，連帶使原本定義好的 `color: new vscode.ThemeColor(...)` 也一併失效！
- **最佳實務解法**：
  - 順位號碼若大於 99，必須強制截斷或 clamp（例如 `rank > 99 ? '99' : String(rank)`）。
  - 詳細文字（如 `#1 • 剛剛`）應放在 `TreeItem.description`，絕不可放進 `FileDecoration.badge`。

---

### 2.2 原生 Explorer 樣式污染與 URI Scheme 隔離

- **陷阱現象**：
  註冊了 `FileDecorationProvider` 之後，使用者原本乾淨的 VS Code 原生檔案總管（Native Explorer）所有檔案也被染成紅黃綠彩虹色，引發使用者反感。
- **根因分析**：
  `FileDecorationProvider` 是全域註冊的，只要檔案的 `Uri.scheme === 'file'`，原生 Explorer 就會拿去繪製。
- **最佳實務解法**：
  - 為擴充套件自己的 TreeView 定義專屬 URI Scheme（例如 `colorful-recent:///...`）。
  - 在 `provideFileDecoration` 進行隔離判斷：除非使用者明確開啟了 `styleNativeExplorer` 設定，否則非專屬 Scheme 一律直接回傳 `undefined`，確保原生 Explorer 的純淨。

---

### 2.3 雙軌視覺（File Icon Theme vs 色彩插值向量圓點）

- **設計考量**：
  - 許多使用者偏好保留自己精心安裝的 File Icon Theme（如 Material Icon, Seti），過度覆寫圖示會破壞沉浸感。
  - 當需要以圖示強調熱度時，應提供開關（如 `showColorDotIcon`），並使用 Data URI 動態產生 SVG 小圓點。
  - **色彩主題自適應**：SVG 圓點顏色計算必須判斷 `activeColorTheme.kind`，深色底採用柔和飽和度（如 2026 Dark 校色），淺色底提高明暗對比度（如 2026 Light 校色）。

---

## 三、資料模型與排序穩定性陷阱

### 3.1 手動拖曳排序 (Manual Sort) 的時間漂移陷阱

- **陷阱現象**：
  使用者將資料夾排序設為手動（Manual）後，只要在某資料夾底下點擊開啟或編輯一個既有檔案，該資料夾就瞬間跳到最上方。
- **根因分析**：
  若資料夾尚未登記於持久化的手動順序陣列，排序時 fallback 到各組最新檔案的時間差（`timeB - timeA`）。一旦檔案被點擊觸碰（touchFile），該組時間變為最新，導致資料夾位置跳動。
- **最佳實務解法**：
  1. **進入 Manual 模式時即刻凍結**：檢查當前所有資料夾，將尚未登記的 `folderKey` 按照當前順序全量追加並持久化。
  2. **比較邏輯排除時間**：
     ```typescript
     folderElements.sort((a, b) => {
       const idxA = manualOrder.indexOf(a.folderKey);
       const idxB = manualOrder.indexOf(b.folderKey);
       if (idxA !== -1 && idxB !== -1) return idxA - idxB;
       if (idxA !== -1) return -1;
       if (idxB !== -1) return 1;
       return a.folderKey.localeCompare(b.folderKey); // 絕不拿檔案時間比較！
     });
     ```

---

### 3.2 垂直分頁同步模式 (Sync with Open Tabs) 的生命週期與歷史保全

- **陷阱現象**：
  在同步分頁模式下，使用者關閉分頁或點擊刪除按鈕，若直接從持久化資料庫中 `delete` 該紀錄，當使用者取消同步模式時，過往的歷史檔案會永遠遺失。
- **最佳實務解法**：
  - **視圖過濾層與持久化存取層嚴格解耦**：
    - 記憶體中單獨維護 `openTabsSet: Set<string>`。
    - 關閉 Tab 或點擊關閉按鈕，僅自 `openTabsSet` 移除（並調用 `vscode.window.tabGroups.close`）。
    - 歷史清單（`recordsMap`）完全不受影響。關閉同步模式時，歷史記錄 100% 完整重現。

---

## 四、原生 TreeView vs WebviewView 架構抉擇

| 評估維度 | 原生 TreeView (`vscode.TreeDataProvider`) | 自訂 WebviewView (`vscode.WebviewViewProvider`) |
| :--- | :--- | :--- |
| **啟動速度與記憶體** | ⚡ **極致輕量**，秒開、零 Webview 處理程序負擔 | 🐢 需載入獨立 Chromium 渲染進程與 DOM 樹 |
| **原生主題融合度** | 🛡️ **天然 100% 融合**，字型、密度、DPI 完全無縫 | ⚙️ 需高度依賴 `--vscode-*` CSS 變數細心校色 |
| **自訂 UI 自由度** | ❌ **受限極大**：無法自訂 Table 欄位、選單 Checkbox 受限、無面板內即時搜尋框 | 🌟 **完全自由**：可任意排版、手寫 Toolbar、Dropdown、拖曳調整欄寬、關鍵字高亮 |
| **適用場景** | 標準導覽樹、最近檔案、大綱清單、單純結構展示 | 複雜檔案總管（含大小/修改時間/Git 狀態的多欄表格）、自訂互動面板、視覺化儀表板 |
