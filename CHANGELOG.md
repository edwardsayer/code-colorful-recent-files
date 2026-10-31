# Change Log

All notable changes to the "code-colorful-recent-files" extension will be documented in this file.

## [Unreleased]

### Removed
- **The legacy `codeColorfulRecentFiles.groupByDirectory` setting is gone.** It was superseded by `groupBy` and is now removed outright instead of being deprecated. On activation the extension translates any leftover value into `groupBy` (only when `groupBy` is unset) and deletes the stale key from your global and workspace settings, so VS Code does not flag it as an unknown setting. Use `groupBy` (`none` / `directory` / `type`).

  **BREAKING CHANGE:** if you scripted the old boolean key, switch to `groupBy`. Setups that only ever used `groupBy` are unaffected.

### Changed
- **Heat colour levels and folder ordering are clamped and typed honestly.** `getHeatColorId()` now clamps out-of-range levels (negative, fractional, `NaN`, `Infinity`, beyond the palette) instead of returning `undefined`, which would have made `new ThemeColor(undefined)` fail at runtime. `getGroupLatestActivity()` returns `undefined` for a group with no usable timestamp instead of `0`, so "no activity data" is no longer conflated with "1970"; such groups sort after groups that have data, and a genuine epoch timestamp still sorts as data.
- **Tab input parsing no longer relies on `instanceof`, and image tabs are no longer dropped silently.** On VS Code builds that do not hand `Tab.input` to extensions (observed on 1.144.0, while VSCodium 1.140.0 hands over `{ uri, viewType }`), custom-editor tabs cannot be resolved; the extension now logs a single warning naming the tab instead of quietly ignoring it. Text tabs are unaffected.
- **Clicking a row keeps the keyboard focus in the list.** The file still opens, now in a **preview** tab like the built-in File Explorer, but the Recent Files view keeps focus so `F2`, `Delete` and `Ctrl` + `Z` work immediately after a click instead of requiring a second click on the view. This changes the previous behaviour, where a single click moved focus into the editor and the shortcuts appeared dead until the view was focused again (backlog B-10).

## [0.3.3] - 2026-10-31

### Added
- **Keyboard shortcuts for the file operations.** With the Recent Files view focused, `F2` renames the selected file, `Delete` deletes it (with the usual confirmation and trash settings) and `Ctrl`+`Z` undoes the last rename or move (`Cmd`+`Z` on macOS). The bindings use a custom `selectedKind` context key instead of `viewItem`, because `viewItem` is always false inside a keybinding `when` clause; `F2`/`Delete` therefore only fire on file rows and never on folder or type groups. The default editor and Explorer shortcuts are unaffected.
- **Rename, Move To…, Delete and Undo File Operation in the recent files view.** Right-click a file to rename it, move it to another folder, or delete it (to the trash when `files.enableTrash` is on, with the usual `explorer.confirmDelete` prompt). Undo reverts the last rename or move. The history list, the pinned folder order and the `.vscode/colorful-recent-files.json` backup are updated together, so the entry follows the file to its new path instead of leaving a stale row behind.

  These commands only appear in trusted workspaces. Delete is not undoable; only rename and move are, and the undo history lives in memory for the current session only.

### Changed
- **Workspace Trust declaration is now `limited` instead of `true`.** The extension is gaining file-modifying commands (rename, move to, delete, undo). The previous `capabilities.untrustedWorkspaces` description promised that the extension never writes to disk, which would stop being true. Reading and displaying recent files still works in untrusted workspaces; the commands that modify files will be unavailable until the workspace is trusted.

## [0.3.2] - 2026-10-26

### Added
- **Multi-select in the Recent Files view.** The tree view now enables `canSelectMany`, so you can `Ctrl`/`Cmd`-click or `Shift`-click several files and drag them out in one gesture. Every distinct path is emitted once, separated by CRLF as required by the VS Code uri-list implementation.

### Fixed
- **Ineffective `application/vnd.code.uri-list` override (0.3.1 regression).** 0.3.1 wrote a second MIME type without declaring it in `dragMimeTypes`. VS Code only creates drag-phase placeholders for declared types, so the extra write was invisible to drop targets and logged `does not declare them in dragMimeTypes` on every drag. The type is now declared and the write takes effect.
- **CHANGELOG accuracy (0.3.1 correction).** The 0.3.1 entry claimed to be documentation-only, but it also changed `src/treeDragAndDrop.ts` behaviour. This release records the actual behaviour change instead of describing it as documentation-only.

### Verified
- File payloads are declared correctly: `text/uri-list` and `application/vnd.code.uri-list` both carry plain `file:` URIs, and neither triggers a `dragMimeTypes` warning.

> **Not verified in this release:** dropping onto **Folder Spaces** panes was not tested in this release's pre-release gate. Any drop target that accepts `text/uri-list` should work, but only the editor drop target was exercised. Cross-extension drop behaviour is not claimed here.

## [0.3.1] - 2026-10-26

> ⚠️ **Correction (see 0.3.2).** The description below understates this release: besides the documentation fixes, 0.3.1 also added an `application/vnd.code.uri-list` write that was **not** declared in `dragMimeTypes`. That write had no effect and produced a VS Code warning on every drag. Fixed in 0.3.2.

### Changed
- Corrected the drag-and-drop documentation. File items **cannot** be dropped onto the built-in **File Explorer** — that is a hard VS Code platform limitation, not something this extension can fix (see below). Dragging onto an editor or any drop target that accepts `text/uri-list` remains supported.

### Documented limitation
- VS Code's built-in Explorer rejects any in-window tree drag at the `dragover` stage. In `workbench.desktop.main.js`, `FileExplorer`'s `handleDragOver` contains `if (o instanceof Lvt) return !1;`, and `Lvt` (an `{elements}`-only drag payload) is assigned to the global `CurrentDragAndDropData` by **any** Monaco tree `onDragStart`. Only OS-level drops (`f8` / `DesktopDragAndDropData`) and the Explorer's own internal model pass that guard. No extension-side MIME or `resourceUri` change can bypass it.
- For moving files between folders, use drag and drop between panes of the same extension, or cut and paste (`Ctrl+C` / `Ctrl+V`) in the Explorer.

## [0.3.0] - 2026-10-25

### Added
- **Drag files out of the Recent Files view.** File items can be dragged onto an editor or any other drop target that accepts `text/uri-list`. Files are written as plain `file:` URIs.

### Fixed
- Dragging a file out previously produced an unusable `colorful-recent:` URI, because VS Code's auto-generated `text/uri-list` carries this extension's custom scheme. The drag handler now overrides it with the real `file:` path.

### Known limitation
- The built-in **File Explorer** does not accept these drops (platform-level `dragover` rejection). This was initially documented as working in 0.3.0; corrected in 0.3.1. See the 0.3.1 entry for the source-level explanation.

## [0.2.1] - 2026-10-25

### Changed
- The file item description now shows only the relative time. The rank number is no longer duplicated there — it stays in the native `FileDecoration` badge on the far right of the row.
- When **Style Native Explorer** is enabled, the built-in Explorer tree and editor tabs receive the heat color but **no rank badge**, so the number no longer competes with file diagnostics or Git indicators.

## [0.2.0] - 2026-10-25

### Added
- Simplified Chinese (zh-cn) localization for the manifest and runtime messages.
- Three-mode grouping (None / Type / Directory), color scheme and time metric options.
- Sync with Open Tabs mode (vertical tabs).
- Color Dot Icons and Style Native Explorer toggles.
- Pinnable Folder/Type groups: pin a group to keep it on top, drag pinned groups to reorder them, and unpinned groups follow sorted by most recent activity. Groups show a pin/unpin button on the right of the row.
- Context menus for tree items: Sync with Open Tabs mode mirrors the editor tab menu (close, close others/saved/all, pin/unpin, open to the side, split, move to new window, copy path, reveal); history mode offers reveal, terminal, find in folder, copy path and remove from history. Folder and Type groups get batch close/remove with confirmation.
- Contributed color tokens `colorfulRecentFiles.heat1`–`heat6` with fixed, theme-independent defaults; users can override them via `workbench.colorCustomizations`.

### Changed
- Display name is now "Colorful Recent Files: Vertical Tabs & History" (extension id and setting keys unchanged).
- View menu redesigned: multi-choice items use `Name: <emoji> Current ➜ Next`; toggles show a trailing emoji only when enabled (Sync ✔️, Color Dot 🟣, Style Native Explorer 🫟).
- File coloring no longer follows the active Color Theme.
- Removed unused command registrations and the `setGroupByDirectory` helper.
- Removed the `folderSortOrder` setting (`latest` / `name` / `manual`) and its menu item. Group ordering is now driven by pinning plus activity-based ordering for unpinned groups.

### Fixed
- Colors did not appear after installing the extension into a running window; the first session now falls back to built-in colors until the window reloads or the Color Theme changes.
- Colors still did not appear after uninstalling, reloading and reinstalling the extension. The first-session detection used a `globalState` version flag, which survives uninstall/reinstall and made the extension believe its color tokens were already registered. Detection now compares the extension's install time with the Extension Host start time.
- First-session fallback used `charts.orange`, which VSCodium and Code-OSS define as `rgba(234, 92, 0, 0.33)` (33% opacity, intended for chart fills). As a text color it was practically invisible, so the orange step now uses the opaque `symbolIcon.classForeground` token.
- English UI showed raw message keys (e.g. `time.justNow`); l10n bundles are now keyed by English text.
- Hardcoded Chinese strings ("工作區根目錄", "剛剛") now go through l10n.
- Internal planning documents are no longer shipped in the VSIX.

## [0.1.0] - 2026-10-23

### Added
- Initial release of Colorful Recent Files.
- Activity bar treeview for recent files.
- Directory grouping toggle with native checked indicator in view title menu.
- Color decorations by last access/modification time using ThemeColor and FileDecorationProvider.
- Clear history and single item removal commands.
- Localized English and Traditional Chinese strings.
