# Colorful Recent Files

Language: **English** | [繁體中文](README.zh-TW.md)

A focused VS Code extension that presents your recently opened and edited files in a dedicated Activity Bar TreeView. It supports one-click directory grouping and native time-based heat decoration (color badges & highlights).

![Icon](assets/icon.svg)

## Features

- 🕒 **Track Recent Files Automatically**: Intelligently monitors active editor switches, opened documents, and saved modifications.
- 📁 **Group by Directory**: Toggle between a flat chronological list and a grouped directory tree from the view header menu (with native checked checkmark indicator).
- 🎨 **Time-based Color Decorations**: Native `FileDecoration` integration maps file recency to standard theme colors:
  - **Fresh (< 15 mins)**: `charts.green` with `●` badge
  - **Warm (< 2 hours)**: `charts.yellow` with `1h` badge
  - **Day (< 24 hours)**: `charts.orange` with `1d` badge
  - **Older**: Neutral secondary color
- ⚡ **Local-First & Lightweight**: Stores history directly in `workspaceState`, zero network calls or external dependencies.

## Extension Settings

This extension contributes the following settings:

* `codeColorfulRecentFiles.groupByDirectory`: Group recent files by parent directory in the treeview (default: `false`).
* `codeColorfulRecentFiles.colorScheme`: Color scheme, supports continuous rank spectrum (`rankSpectrum`) or time buckets (`timeBucket`, default: `rankSpectrum`).
* `codeColorfulRecentFiles.showColorDotIcon`: Render smooth colored dot icon instead of native file icon (default: `false`).
* `codeColorfulRecentFiles.styleNativeExplorer`: Apply decorations to native VS Code Explorer as well (default: `false`).
* `codeColorfulRecentFiles.maxRecentFiles`: Maximum number of files to keep in history (default: `50`).
* `codeColorfulRecentFiles.highlightMode`: Reference metric for color calculation (`lastAccess` or `lastModified`, default: `lastAccess`).

## Color Customization & Theme Patching

This extension contributes 6 customizable heat color tokens (`colorfulRecentFiles.heat1` ~ `heat6`). By default, they automatically adapt to your theme (calibrated with 2026 Dark and 2026 Light palettes).

You can easily override these tokens with custom Hex RGB colors in your `settings.json`:

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

(Light theme recommended: `heat1`: `#AD0707`, `heat2`: `#D18616`, `heat3`: `#667309`, `heat4`: `#388A34`, `heat5`: `#1A5CFF`, `heat6`: `#652D90`)

## Commands

* `Recent Files: Refresh`: Re-scan file existence and update decorations.
* `Recent Files: Group by Directory`: Toggle hierarchical directory grouping.
* `Recent Files: Clear History`: Clear stored recent files history for current workspace.
* `Recent Files: Remove from History`: Remove an individual file from history.

## License

[MIT](LICENSE)
