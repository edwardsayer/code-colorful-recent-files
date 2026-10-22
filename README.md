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
* `codeColorfulRecentFiles.maxRecentFiles`: Maximum number of files to keep in history (default: `50`).
* `codeColorfulRecentFiles.highlightMode`: Reference metric for color calculation (`lastAccess` or `lastModified`, default: `lastAccess`).

## Commands

* `Recent Files: Refresh`: Re-scan file existence and update decorations.
* `Recent Files: Group by Directory`: Toggle hierarchical directory grouping.
* `Recent Files: Clear History`: Clear stored recent files history for current workspace.
* `Recent Files: Remove from History`: Remove an individual file from history.

## License

[MIT](LICENSE)
