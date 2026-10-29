# Change Log

All notable changes to the "code-colorful-recent-files" extension will be documented in this file.

## [Unreleased]

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
