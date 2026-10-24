# 外部開源 VS Code 擴充套件架構與設計調研筆記

本文件針對近期深度調研的兩個外部開源檔案總管擴充套件進行架構剖析、關鍵實作技術拆解，並評估其優劣勢與對後續架構演進的借鑑價值。

---

## 專案一：R35007 / secondary-explorer-vscode-extension

- **Repository**: [https://github.com/R35007/secondary-explorer-vscode-extension](https://github.com/R35007/secondary-explorer-vscode-extension)
- **定位目標**: 提供第二個獨立的檔案總管側邊欄，用於檢視與管理額外的專案、筆記或參考資料夾。

### 1. 技術架構分析
- **UI 基礎**: 100% 原生 TreeView (`vscode.TreeDataProvider`)。
- **無 Submenu**: 該專案在 `package.json` 中**完全沒有宣告 `contributes.submenus`**。

### 2. 「Group by Tags」打勾實作真相
在調查該擴充套件的選單打勾效果時，發現其選單項目雖然顯示勾號，但會把選項文字往後擠。檢視其 `package.json` 原始宣告：

```json
{
  "command": "secondary-explorer.groupByTags",
  "title": "Group By Tags",
  "icon": "$(tag)"
},
{
  "command": "secondary-explorer.groupByNone",
  "title": "✔ Group By Tags",
  "icon": "$(tag-remove)"
}
```

在 `menus["view/title"]` 的掛載方式：
```json
{
  "command": "secondary-explorer.groupByTags",
  "when": "view == secondaryExplorerView && !config.secondaryExplorer.groupByTags",
  "group": "secondaryExplorer@2"
},
{
  "command": "secondary-explorer.groupByNone",
  "when": "view == secondaryExplorerView && config.secondaryExplorer.groupByTags",
  "group": "secondaryExplorer@3"
}
```

### 3. 設計缺陷與結論
- **缺陷根因**：它沒有使用任何 VS Code 原生 `toggled` 機制，而是直接在 `title` 字串開頭硬編碼 Unicode 字元 `"✔ "`。
- **排版破壞**：勾選時第一個字元變成 `✔ `，導致後續文字整行被向右推擠 2 個字元，與其他未勾選的命令垂直並列時，**左側文字完全無法齊頭對齊**，視覺參差不齊。
- **啟發**：此專案印證了原生 TreeView 確實無法靠原生方式在下拉選單產生原生 Checkbox，若要以純文字呈現狀態，**務必改採尾端標籤法（例如 `Group by Tags  ✔️`）**，確保左側始終齊頭對齊。

---

## 專案二：Vince1024 / Explorer-Enhanced-For-VsCode

- **Repository**: [https://github.com/Vince1024/Explorer-Enhanced-For-VsCode](https://github.com/Vince1024/Explorer-Enhanced-For-VsCode)
- **定位目標**: 強化版檔案總管，上方以資料夾為先，下方提供類似 Windows 檔案總管的詳細清單（含修改時間、大小、即時篩選、自訂選單）。

### 1. 技術架構分析：雙軌混成架構 (Hybrid Architecture)
該專案將視圖容器拆分為兩個部分（見其 `package.json`）：
```json
"views": {
  "explorer-enhanced": [
    {
      "id": "explorer-enhanced.folderTree",
      "name": "Folders"                     // 上半部：原生 TreeView
    },
    {
      "type": "webview",
      "id": "explorer-enhanced.filePane",
      "name": "Files"                       // 下半部：自訂 WebviewView！
    }
  ]
}
```
**關鍵核心**：其下方的 Files 面板**直接宣告為 `webview` 視圖**，徹底擺脫了原生 TreeView 的排版枷鎖！

### 2. 前端技術選型：極簡 Vanilla JS，零肥大框架！
- **無 React / Vue / Svelte**：全專案完全沒有引入任何沉重的前端框架。
- **極度純淨的相依套件**：
  - `dependencies`: 僅有 `"@vscode/codicons": "^0.0.45"`（官方圖示字型）。
  - `devDependencies`: 僅有 TypeScript、ESLint 與 VSCE 打包工具。
- **模組化原生實作**：
  - `resources/filePane.shell.html`：基礎 HTML 骨架與 CSP 宣告。
  - `resources/filePane.common.css`：核心樣式，完整繼承 `--vscode-*` CSS 變數。
  - `resources/filePane.table.js`：詳細資訊表格清單（DOM 動態建立與虛擬滾動最佳化）。
  - `resources/filePane.iconGrid.js`：大圖示網格佈局。
  - `resources/filePane.columns.js`：支援滑鼠拖曳調整欄寬（Resizable Header Columns）。
  - `resources/filePane.menus.js`：**手寫 Toolbar、Dropdown 下拉選單與右鍵 Context Menu**。
  - `resources/filePane.filterHighlight.js`：搜尋框即時過濾與關鍵字高亮。

### 3. 下拉選單與「完美打勾（不推擠文字）」實作細節
在 `filePane.shell.html` 與 `filePane.common.css` 中，下拉選單完全由 HTML + CSS 自行渲染：

```html
<ul class="views-menu" id="viewsMenu" role="menu" hidden>
  <li role="menuitemradio" data-layout="icons">
    <span class="views-menu-check" aria-hidden="true"></span>
    <span class="views-menu-ico">...</span>
    <span class="views-menu-txt">Icons</span>
  </li>
  <li role="menuitemradio" data-layout="list">
    <span class="views-menu-check" aria-hidden="true"></span>
    <span class="views-menu-ico">...</span>
    <span class="views-menu-txt">List</span>
  </li>
</ul>
```

CSS 核心排版：
```css
/* 固定佔位 22px，永遠保留勾選/指示器位置 */
.views-menu-check {
  flex: 0 0 22px;
  width: 22px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 僅在激活時渲染圓點或勾號符號 */
.views-menu-check::after {
  content: '';
  display: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.views-menu li.views-menu-active .views-menu-check::after {
  display: block;
}
```

- **優勢關鍵**：因為左側的 `.views-menu-check` 擁有固定的 `22px` 寬度，**未選中時為空白佔位，選中時顯示圓點／勾號**。後方的文字首字位置永遠一致，**徹底解決了推擠文字的問題**。

### 4. 與 VS Code 原生外觀無縫融為一體的秘訣
該 Webview 之所以讓人感覺「完全像 VS Code 官方內建介面」，是因為它全面綁定了編輯器全域 CSS 變數：
- 背景：`var(--vscode-menu-background)`
- 文字：`var(--vscode-menu-foreground)`
- 邊框：`var(--vscode-menu-border)`
- 選中反白：`var(--vscode-menu-selectionBackground)`
- 字型大小：`var(--vscode-font-size)`
- 官方圖示：配合 `@vscode/codicons`，圖示外觀與原生 100% 一致。

---

## 三、兩者對比與借鑑總結

| 比較項目 | R35007 / secondary-explorer | Vince1024 / Explorer-Enhanced |
| :--- | :--- | :--- |
| **介面架構** | 純原生 TreeView | 原生 TreeView + WebviewView 混成 |
| **選單機制** | package.json 靜態成對命令切換 | Webview 內自刻純 HTML/CSS Dropdown |
| **打勾表現** | 標題開頭硬寫 `✔ `，導致文字向後推擠 | 固定寬度佔位槽，文字絕對齊頭對齊 |
| **效能開銷** | 極低（原生 Extension Host） | 輕中度（多一個 Webview 進程，但採純 Vanilla JS，無 React 負擔） |
| **擴充自由度** | 極低（受 VS Code Manifest 規格限制） | 極高（可支援多欄位排序、就地搜尋框、客製化菜單） |

### 對後續專案演進的指引：
1. **若維持原生 TreeView**：
   - 應堅持「**尾端簡潔標記法**」或「**頂層狀態反映法**」，避免使用開頭推擠文字的作法。
2. **若未來評估升級為 WebviewView**：
   - 強烈建議參考 `Explorer-Enhanced` 的 **Vanilla JS + Codicons + VS Code CSS Variables** 模式。
   - 避免引入厚重的前端框架（如 React / Tailwind），既能保有毫秒級即時響應，又能享有完全自訂 Toolbar、無推擠選單與自訂表格欄位的強大表現力。
