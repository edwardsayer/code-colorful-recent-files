import * as vscode from 'vscode';
import { canModifyFiles } from './fileOps';

/**
 * Workspace Trust 閘門。
 *
 * **所有會修改磁碟的命令，handler 進入點都必須先呼叫 `requireTrust()`。**
 *
 * 為什麼不能只靠 manifest 的 `when: isWorkspaceTrusted`：
 * 那只是 UI 層的顯示條件，命令仍可從命令面板、其他擴充的
 * `vscode.commands.executeCommand` 或金鑰綁定之外的途徑被呼叫。
 * manifest 的 `capabilities.untrustedWorkspaces` 宣告的是**行為承諾**，
 * 必須由執行期檢查兌現，否則宣告即不誠實。
 *
 * 純決策邏輯在 `fileOps.ts` 的 `canModifyFiles()`（無 `vscode` 依賴、可單元測試）；
 * 本模組只負責取得信任狀態與顯示提示。
 */

/** 拒絕訊息 key（`l10n/bundle.l10n*.json` 必須有對應條目）。 */
export const UNTRUSTED_MESSAGE = 'Trust the workspace before modifying files.';

/**
 * 檢查目前工作區是否受信任。
 *
 * - 受信任 → 回傳 `true`，呼叫端繼續執行。
 * - 未受信任 → 顯示警告並回傳 `false`，呼叫端必須立即 `return`。
 *
 * 提示一律走 `vscode.l10n.t()`，不得靜默失敗（使用者按了沒反應比報錯更難排查）。
 */
export function requireTrust(): boolean {
  const trusted = vscode.workspace.isTrusted;
  if (canModifyFiles(trusted)) {
    return true;
  }
  void vscode.window.showWarningMessage(vscode.l10n.t(UNTRUSTED_MESSAGE));
  return false;
}
