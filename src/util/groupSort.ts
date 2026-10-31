/**
 * 分組排序純邏輯（不依賴 vscode，可單元測試）
 *
 * 規則（依使用者核定）：
 * 1. 已 Pin 的分組永遠排在最上方，並依照 pinnedOrder 的手動拖曳順序排列。
 * 2. 未 Pin 的分組接在已 Pin 分組之後，依組內最近存取／變更時間由新到舊排序。
 * 3. pinnedOrder 中若殘留目前已不存在（或暫時不可見）的分組 key，直接忽略，
 *    但不清除紀錄，使該分組重新出現時仍維持 Pin 狀態。
 */

/** 排序所需的最小分組資訊 */
export interface SortableGroup {
  folderKey: string;
  /** 組內最活躍檔案的時間戳記（毫秒）；`undefined` 表示該組沒有可用的活動時間 */
  latestActivity?: number;
}

/**
 * 依「已 Pin 優先 + 手動順序 + 未 Pin 依時間」排序分組。
 * 回傳新陣列，不修改輸入。
 */
export function orderGroups<T extends SortableGroup>(groups: readonly T[], pinnedOrder: readonly string[]): T[] {
  const pinnedIndex = new Map<string, number>();
  pinnedOrder.forEach((key, index) => {
    if (!pinnedIndex.has(key)) {
      pinnedIndex.set(key, index);
    }
  });

  const pinned: T[] = [];
  const unpinned: T[] = [];

  for (const group of groups) {
    if (pinnedIndex.has(group.folderKey)) {
      pinned.push(group);
    } else {
      unpinned.push(group);
    }
  }

  pinned.sort((a, b) => (pinnedIndex.get(a.folderKey) as number) - (pinnedIndex.get(b.folderKey) as number));
  unpinned.sort((a, b) => {
    // 沒有活動資料的分組接在最後（再依 key 排序），不要與「1970 年」混為一談
    const aTime = a.latestActivity;
    const bTime = b.latestActivity;
    if (aTime !== bTime) {
      if (aTime === undefined) return 1;
      if (bTime === undefined) return -1;
      return bTime - aTime;
    }
    return a.folderKey.localeCompare(b.folderKey);
  });

  return [...pinned, ...unpinned];
}

/** 分組是否已 Pin */
export function isPinned(pinnedOrder: readonly string[], folderKey: string): boolean {
  return pinnedOrder.includes(folderKey);
}

/**
 * 將分組加入已 Pin 清單（預設附加在已 Pin 區塊末尾）。
 * 已存在時不重複加入，回傳原順序的複本。
 */
export function addToPinnedOrder(pinnedOrder: readonly string[], folderKey: string): string[] {
  if (pinnedOrder.includes(folderKey)) {
    return [...pinnedOrder];
  }
  return [...pinnedOrder, folderKey];
}

/** 從已 Pin 清單移除分組 */
export function removeFromPinnedOrder(pinnedOrder: readonly string[], folderKey: string): string[] {
  return pinnedOrder.filter((key) => key !== folderKey);
}

/**
 * 在已 Pin 清單內移動分組（拖曳排序）。
 *
 * - `targetKey` 為落點分組時：拖曳項目插入到該分組之前。
 * - `targetKey` 未提供或不在清單中時：附加到已 Pin 區塊末尾。
 * - 拖曳項目不在清單中（未 Pin）時不予處理，直接回傳原順序複本。
 * - 落點若在拖曳集合內（例如拖到自己身上）視為原地不動，回傳原順序複本，
 *   避免「拖到自己」意外被移到末尾。
 */
export function moveWithinPinnedOrder(
  pinnedOrder: readonly string[],
  draggedKeys: readonly string[],
  targetKey?: string
): string[] {
  const movable = draggedKeys.filter((key) => pinnedOrder.includes(key));
  if (movable.length === 0) {
    return [...pinnedOrder];
  }

  const remaining = pinnedOrder.filter((key) => !movable.includes(key));

  // 拖到自己（或拖曳集合內部）→ 原地不動
  if (targetKey !== undefined && movable.includes(targetKey)) {
    return [...pinnedOrder];
  }

  const validTarget = targetKey !== undefined && remaining.includes(targetKey);
  if (!validTarget) {
    return [...remaining, ...movable];
  }

  const targetIndex = remaining.indexOf(targetKey as string);
  return [...remaining.slice(0, targetIndex), ...movable, ...remaining.slice(targetIndex)];
}
