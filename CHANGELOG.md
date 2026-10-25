# Change Log

All notable changes to the "code-colorful-recent-files" extension will be documented in this file.

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
