# Colorful Recent Files: Vertical Tabs & History
Language: **English** | [繁體中文](README.zh-TW.md)

A focused VS Code extension that presents your recently opened and edited files in a dedicated Activity Bar TreeView. It supports one-click directory grouping and native time-based heat decoration (color badges & highlights).

![Icon](assets/icon.svg)

## Features

- 🕒 **Track Recent Files Automatically**: Intelligently monitors active editor switches, opened documents, and saved modifications.
- 📁 **Three Grouping Modes (Flat / Directory / Type)**:
  - **Flat**: Chronological recent files list.
  - **Directory**: Hierarchical tree grouped by folder paths.
  - **Type (Extension)**: Grouped by file extensions or view types in uppercase (e.g. `TS`, `JSON`, `MD`, `OTHER`).
- 📑 **Sync with Open Tabs (Vertical Tabs Mode)**:
  - When enabled, **only displays currently opened editor tabs**, effectively serving as a fast vertical tabs sidebar.
  - Closing tabs in the editor or removing them from the tree will hide them from the view and close the editor tab; **historical access logs are safely preserved** and fully restored when turning sync off.
- 📌 **Pinnable Groups with Drag-and-Drop Ordering**:
  - Pin any Folder or Type group with the pin button on the right of the group row (or `Pin Group` in the context menu). Pinned groups stay on top and show a 📌 marker.
  - **Pinned groups** are ordered manually: drag one pinned group onto another to reposition it. Unpinned groups can never move above pinned ones.
  - **Unpinned groups** always follow below the pinned block, sorted by most recent activity (respecting the Time Metric setting).
- 🎨 **Time-based Color Decorations**: Native `FileDecoration` integration maps file recency to standard theme colors:
  - **Fresh (< 15 mins)**: `heat4` with `●` badge
  - **Warm (< 2 hours)**: `heat3` with `1h` badge
  - **Day (< 24 hours)**: `heat2` with `1d` badge
  - **Older**: Neutral secondary color
- ⚡ **Local-First & Lightweight**: Stores history directly in `workspaceState`, zero network calls or external dependencies.

## Visual Styles: Native File Icons vs Color Dot Icons

This extension provides two distinct visual presentations:

1. **Native File Icons (Default)**:
   Retains your VS Code File Icon Theme (e.g., Seti, Material), while recency and timing are displayed via native `FileDecoration` descriptions (`#Rank • Relative Time`, e.g., `#1 • just now`).
2. **Color Dot Icons (`showColorDotIcon`)**:
   Replaces file icons in the treeview with clean, smooth SVG color dots. The colors use piecewise linear interpolation and automatically adapt between **2026 Dark** (soft pastels) and **2026 Light** (high-contrast jewels).

### How to Enable Color Dot Icons?

- **Option 1: Via VS Code Settings GUI**
  1. Open Settings (`Ctrl + ,` or `Cmd + ,` on macOS).
  2. Search for: `Colorful Recent Files: Show Color Dot Icon`.
  3. Check the box for "**Show Color Dot Icon**".

- **Option 2: Via `settings.json`**
  Add the following entry to your `settings.json`:
  ```json
  "codeColorfulRecentFiles.showColorDotIcon": true
  ```

---

## Reading the View Menu

The `...` menu in the view title uses two notations:

- **Multi-choice items** (`Name: <emoji> Current ➜ Next`): the **emoji marks the current value**; the value after the arrow is **what you get when you click** (it cycles back to the first value after the last one). The next value has no emoji.
  - `Group by: ✖️ None ➜ Type` → currently *None*; click to switch to *Type*.
  - Items: Group by, Color Scheme, Time Metric.
- **Toggles** (`Name` / `Name <emoji>`): a **trailing emoji means enabled**; no emoji means disabled. Click to flip.
  - `Sync with Open Tabs` → off; `Sync with Open Tabs ✔️` → on.
  - `Color Dot Icons 🟣`, `Style Native Explorer 🫟` follow the same rule.

## Extension Settings

You can configure the extension using the following settings:

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `codeColorfulRecentFiles.groupBy` | `string` | `"none"` | **Grouping Mode**: `"none"` (flat list), `"directory"` (hierarchical directory grouping), or `"type"` (uppercase file extension groups). |
| `codeColorfulRecentFiles.syncWithOpenTabs` | `boolean` | `false` | **Sync with Open Tabs**: Show only currently open editor tabs (Vertical Tabs mode). |
| `codeColorfulRecentFiles.showColorDotIcon` | `boolean` | `false` | **Color Dot Switch**: Render smooth colored dot icons instead of default file icons. |
| `codeColorfulRecentFiles.groupByDirectory` | `boolean` | `false` | **Directory Grouping (Legacy)**: Extended by `groupBy`. |
| `codeColorfulRecentFiles.colorScheme` | `string` | `"rankSpectrum"` | **Color Scheme**: `"rankSpectrum"` (smooth rainbow spectrum), `"timeBucket"` (time step intervals), or `"plainText"` (neutral text mode without heat colors, retains color dot icons). |
| `codeColorfulRecentFiles.styleNativeExplorer` | `boolean` | `false` | **Native Explorer Styling**: Apply colorful decorations to the native VS Code Explorer as well (default false for clean separation). |
| `codeColorfulRecentFiles.maxRecentFiles` | `number` | `50` | **History Limit**: Maximum number of recent files to retain (5 ~ 500). |
| `codeColorfulRecentFiles.highlightMode` | `string` | `"lastAccess"` | **Time Metric**: `"lastAccess"` (open/focus) or `"lastModified"` (edit/save). |

---

## Color Customization & Theme Patching

This extension contributes 6 customizable heat color tokens (`colorfulRecentFiles.heat1` ~ `heat6`) with fixed, theme-independent defaults calibrated against the official 2026 Dark and 2026 Light standards.

If you are using a third-party theme with suboptimal contrast, you can override these tokens directly with raw Hex RGB values in `settings.json`:

### 🌙 Dark Theme Recommended Patch (2026 Dark Calibrated)
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

### ☀️ Light Theme Recommended Patch (2026 Light High Contrast)
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

## Commands

* `Recent Files: Refresh`: Re-scan file existence and update decorations.
* `Recent Files: Group by Directory`: Toggle hierarchical directory grouping.
* `Recent Files: Clear History`: Clear stored recent files history for current workspace.
* `Recent Files: Remove from History`: Remove an individual file from history.

## License

[MIT](LICENSE)
