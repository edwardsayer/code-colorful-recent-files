# Colorful Recent Files: Vertical Tabs & History

Language: **English** | [繁體中文](README.zh-TW.md) | [简体中文](README.zh-CN.md)

A focused VS Code extension that presents your recently opened and edited files in a dedicated Activity Bar TreeView, with native time-based heat decoration, three grouping modes, and a vertical-tabs mode.

<img src="assets/icon.png" alt="Colorful Recent Files icon" width="128" />

![Recent Files list view](assets/screenshots/01-list-view.png)

## Features

- 🕒 **Automatic tracking**: records files when you switch to, open, or save them. History is stored in `workspaceState` — no network access, no external service.
- 📑 **Vertical tabs (Sync with Open Tabs)**: when enabled, the view lists **only your open editor tabs**, so it works as a fast vertical tab bar. Closing a tab from the view closes the editor tab too; your historical access log is preserved and reappears when you turn sync off.
- 📁 **Three grouping modes**:
  - **Flat** — a single recent-files list.
  - **Directory** — grouped by folder path.
  - **Type** — grouped by extension in uppercase (`TS`, `JSON`, `MD`, `OTHER`). Pure-numeric extensions are bucketed by length: 1–3 digits, 4–6 digits, 7+ digits.
- 📌 **Pinnable groups with manual ordering**: hover a Folder or Type group and click the inline pin button that appears on the right of the group row. Pinned groups move to the top, show a 📌 marker, and keep a manual order you can drag to change. Unpinned groups always follow below the pinned block, sorted by most recent activity (following your Time Metric setting).
- 🎨 **Three color schemes**: `rankSpectrum` (default, smooth rainbow by rank), `timeBucket` (age-based steps), or `plainText` (neutral text, color dots only).
- 🖱️ **Multi-select and drag out**: `Ctrl`/`Cmd`-click or `Shift`-click several files, then drag them to an editor or any drop target that accepts `text/uri-list`. The payload is plain `file:` URIs (one per line, CRLF-separated, deduplicated), so the target sees real filesystem paths.
  - **Not supported: the built-in File Explorer.** This is a hard VS Code platform limitation, not an extension bug — the Explorer rejects any in-window tree drag at the `dragover` stage (`if (o instanceof Lvt) return !1;` in `workbench.desktop.main.js`), and no MIME or `resourceUri` change can bypass it. To move files between folders, cut and paste in the Explorer instead.
- 🗂️ **Rich context menu**: close/pin/split/move actions that mirror the editor tab menu in Sync mode, plus reveal, terminal, find-in-folder, and copy-path actions.
- 🎨 **Native decorations everywhere (optional)**: turn on **Style Native Explorer** to apply the same heat colors to the built-in Explorer tree and editor tabs.

## Screenshots

| Flat list | Directory grouping | Type grouping |
|---|---|---|
| ![Flat](assets/screenshots/01-list-view.png) | ![Directory](assets/screenshots/02-group-directory.png) | ![Type](assets/screenshots/03-group-type.png) |

| Pinned groups | Color dot icons | Plain text scheme |
|---|---|---|
| ![Pinned](assets/screenshots/04-pinned-groups.png) | ![Color dots](assets/screenshots/05-color-dot-icons.png) | ![Plain text](assets/screenshots/06-plain-text.png) |

| Vertical tabs mode | View menu | Context menu |
|---|---|---|
| ![Sync](assets/screenshots/07-sync-open-tabs.png) | ![View menu](assets/screenshots/08-view-menu.png) | ![Context menu](assets/screenshots/09-context-menu.png) |

## Rank numbers appear exactly once

The file item's description shows only the relative time (e.g. `just now`, `11m`, `13h`). The rank is drawn by the native `FileDecoration` badge on the far right of the row — it is not repeated in the text.

When **Style Native Explorer** is on, the same decoration is applied to the built-in Explorer and to editor tabs, but **color only, without the rank badge**, so it never collides with file diagnostics or Git indicators.

## Visual styles: native file icons vs color dots

1. **Native file icons (default)**: keeps your VS Code file icon theme (Seti, Material, …). Recency is shown by the decoration color and the rank badge.
2. **Color dot icons** (`showColorDotIcon`): replaces file icons in the view with smooth SVG color dots. Dot colors use piecewise linear interpolation and adapt to light and dark themes.

To enable color dots:

- **Settings UI**: open Settings (`Ctrl+,` / `Cmd+,`), search for `Colorful Recent Files: Show Color Dot Icon`, and tick the box.
- **`settings.json`**:
  ```json
  "codeColorfulRecentFiles.showColorDotIcon": true
  ```

## Reading the view menu

The `...` menu in the view title uses two notations:

- **Multi-choice items** (`Name: <emoji> Current ➜ Next`): the **emoji marks the current value**; the value after the arrow is **what you get when you click**, and it cycles back to the first value after the last one.
  - `Group by: ✖️ None ➜ Type` → currently *None*; click to switch to *Type*.
  - Items: Group by, Color Scheme, Time Metric.
- **Toggles** (`Name` / `Name <emoji>`): a **trailing emoji means enabled**; no emoji means disabled. Click to flip.
  - `Sync with Open Tabs` → off; `Sync with Open Tabs ✔️` → on.
  - `Color Dot Icons 🟣` and `Style Native Explorer 🫟` follow the same rule.

## Settings

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `codeColorfulRecentFiles.groupBy` | `string` | `"none"` | Grouping mode: `"none"` (flat), `"directory"`, or `"type"` (uppercase extension groups). |
| `codeColorfulRecentFiles.syncWithOpenTabs` | `boolean` | `false` | Show only currently open editor tabs (vertical tabs mode). |
| `codeColorfulRecentFiles.showColorDotIcon` | `boolean` | `false` | Render colored dot icons instead of the file icon theme's icons. |
| `codeColorfulRecentFiles.colorScheme` | `string` | `"rankSpectrum"` | `"rankSpectrum"` (rainbow by rank), `"timeBucket"` (age-based steps), or `"plainText"` (neutral text, keeps color dots). |
| `codeColorfulRecentFiles.styleNativeExplorer` | `boolean` | `false` | Also decorate the built-in Explorer tree and editor tabs (color only, no rank badge). |
| `codeColorfulRecentFiles.highlightMode` | `string` | `"lastAccess"` | Time metric: `"lastAccess"` (open/focus) or `"lastModified"` (edit/save). |
| `codeColorfulRecentFiles.maxRecentFiles` | `number` | `50` | Maximum number of files kept in history (5–500). Changes apply immediately. |
| `codeColorfulRecentFiles.groupByDirectory` | `boolean` | `false` | Legacy directory-grouping flag, superseded by `groupBy`. |

## Color customization

This extension contributes six color tokens (`colorfulRecentFiles.heat1` … `heat6`) with fixed, theme-independent defaults, so file colors stay consistent across color themes. You can override them with `workbench.colorCustomizations`:

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

> **Note**: VS Code registers contributed colors only when the window starts. If you install the extension into an already-running window, colors fall back to built-in tokens for that session and switch to the heat tokens after a window reload or a color theme change.

## Commands

All commands live in the `Recent Files` category. The tables below summarize the commands you reach from the UI; the command palette exposes the toggles and cycles directly (`Refresh`, `Clear History`, `Open File`, `Remove from History`, plus the `Group by` / `Color Scheme` / `Time Metric` cycles and the `Sync with Open Tabs` / `Color Dot Icons` / `Style Native Explorer` toggles).

**View title (`...` menu)**

| Command | What it does |
| :--- | :--- |
| `Refresh` | Re-scan files and update decorations. |
| `Group by: …` | Cycle the grouping mode (Flat / Directory / Type). |
| `Sync with Open Tabs` | Toggle vertical tabs mode. |
| `Color Scheme: …` | Cycle the color scheme (Rainbow Spectrum / Time Buckets / Plain Text). |
| `Color Dot Icons` | Toggle colored dot icons. |
| `Style Native Explorer` | Toggle decorating the built-in Explorer and editor tabs. |
| `Time Metric: …` | Cycle the time metric (Access Time / Modify Time). |
| `Clear History` | Clear the stored history for this workspace. |

**Right-click on a file (Sync mode)**

`Close Tab` · `Close Other Tabs` · `Close Saved Tabs` · `Close All Tabs` · `Pin / Unpin Tab` · `Open to the Side` · `Split Right` · `Split Down` · `Move to New Window` · `Remove from History` · `Reveal in Explorer` · `Reveal in OS` · `Copy Path` · `Copy Relative Path`

**Right-click on a file (history mode)**

`Open to the Side` · `Remove from History` · `Reveal in Explorer` · `Reveal in OS` · `Copy Path` · `Copy Relative Path`

**Group row inline button**

`Pin Group` / `Unpin Group` — appears on the right of a Folder or Type group row on hover. Pinning and unpinning are **inline buttons only**; they are not items in the right-click menu.

**Right-click on a group**

`Close Tabs in Group` (Sync mode) · `Remove Group from History` (history mode) · `Open in Terminal` · `Find in Folder` · `Reveal in Explorer` · `Copy Path`

## Requirements and limitations

- Requires VS Code **1.85.0** or newer; desktop only (virtual workspaces are not supported).
- Works in untrusted workspaces: the extension only reads and writes extension state and never executes workspace code.
- Dragging **into** the built-in File Explorer is not possible for any extension (see above).

## License

[MIT](LICENSE)
