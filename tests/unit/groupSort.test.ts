import { describe, expect, it } from 'vitest';
import {
  addToPinnedOrder,
  isPinned,
  moveWithinPinnedOrder,
  orderGroups,
  removeFromPinnedOrder,
  type SortableGroup,
} from '../../src/util/groupSort';

const group = (folderKey: string, latestActivity: number): SortableGroup => ({ folderKey, latestActivity });

describe('orderGroups', () => {
  it('puts pinned groups first in manual order, then unpinned by time desc', () => {
    const groups = [
      group('type:TS', 100),
      group('type:JSON', 900),
      group('type:MD', 500),
      group('type:OTHER', 700),
    ];
    const result = orderGroups(groups, ['type:MD', 'type:TS']);
    expect(result.map((g) => g.folderKey)).toEqual(['type:MD', 'type:TS', 'type:JSON', 'type:OTHER']);
  });

  it('sorts unpinned groups by latest activity when nothing is pinned', () => {
    const groups = [group('a', 10), group('b', 30), group('c', 20)];
    expect(orderGroups(groups, []).map((g) => g.folderKey)).toEqual(['b', 'c', 'a']);
  });

  it('breaks ties on unpinned groups by folderKey', () => {
    const groups = [group('z', 100), group('a', 100)];
    expect(orderGroups(groups, []).map((g) => g.folderKey)).toEqual(['a', 'z']);
  });

  it('ignores stale pinned keys and does not mutate the input', () => {
    const groups = [group('type:TS', 100), group('type:JSON', 200)];
    const pinnedOrder = ['type:GONE', 'type:JSON'];
    const result = orderGroups(groups, pinnedOrder);
    expect(result.map((g) => g.folderKey)).toEqual(['type:JSON', 'type:TS']);
    expect(pinnedOrder).toEqual(['type:GONE', 'type:JSON']);
    expect(groups.map((g) => g.folderKey)).toEqual(['type:TS', 'type:JSON']);
  });

  it('keeps pinned groups above unpinned groups even when unpinned is newer', () => {
    const groups = [group('pinned', 1), group('fresh', 999999)];
    expect(orderGroups(groups, ['pinned']).map((g) => g.folderKey)).toEqual(['pinned', 'fresh']);
  });
});

describe('addToPinnedOrder / removeFromPinnedOrder / isPinned', () => {
  it('appends new keys and never duplicates', () => {
    expect(addToPinnedOrder([], 'a')).toEqual(['a']);
    expect(addToPinnedOrder(['a'], 'b')).toEqual(['a', 'b']);
    expect(addToPinnedOrder(['a', 'b'], 'a')).toEqual(['a', 'b']);
  });

  it('removes keys without touching the original array', () => {
    const original = ['a', 'b', 'c'];
    const result = removeFromPinnedOrder(original, 'b');
    expect(result).toEqual(['a', 'c']);
    expect(original).toEqual(['a', 'b', 'c']);
  });

  it('reports pinned membership', () => {
    expect(isPinned(['a'], 'a')).toBe(true);
    expect(isPinned(['a'], 'b')).toBe(false);
  });
});

describe('moveWithinPinnedOrder', () => {
  const order = ['a', 'b', 'c'];

  it('inserts dragged key before the drop target', () => {
    expect(moveWithinPinnedOrder(order, ['c'], 'a')).toEqual(['c', 'a', 'b']);
    expect(moveWithinPinnedOrder(order, ['a'], 'c')).toEqual(['b', 'a', 'c']);
  });

  it('appends to the end when target is undefined', () => {
    expect(moveWithinPinnedOrder(order, ['a'], undefined)).toEqual(['b', 'c', 'a']);
  });

  it('appends to the end when target is not pinned', () => {
    expect(moveWithinPinnedOrder(order, ['a'], 'unpinned')).toEqual(['b', 'c', 'a']);
  });

  it('is a no-op for keys that are not pinned', () => {
    expect(moveWithinPinnedOrder(order, ['not-pinned'], 'a')).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input order', () => {
    const original = ['a', 'b', 'c'];
    moveWithinPinnedOrder(original, ['c'], 'a');
    expect(original).toEqual(['a', 'b', 'c']);
  });

  it('treats a target inside the dragged set as a no-op', () => {
    expect(moveWithinPinnedOrder(order, ['a'], 'a')).toEqual(['a', 'b', 'c']);
    expect(moveWithinPinnedOrder(order, ['a', 'b'], 'b')).toEqual(['a', 'b', 'c']);
  });
});
