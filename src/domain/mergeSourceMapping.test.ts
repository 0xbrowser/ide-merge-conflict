import { describe, expect, it } from 'vitest';
import { parseConflicts } from './conflictParser';
import { buildMergeSourceRanges } from './mergeSourceMapping';
import { resolveConflictText } from './resolution';

describe('buildMergeSourceRanges', () => {
  it('retains the remaining block source location after an earlier block is resolved', () => {
    const result = [
      '<<<<<<< HEAD', 'current one', '=======', 'incoming one', '>>>>>>> one',
      'between',
      '<<<<<<< HEAD', 'current two', '=======', 'incoming two', '>>>>>>> two',
    ].join('\n');
    const current = 'prefix\ncurrent one\nbetween\ncurrent two\nsuffix';
    const incoming = 'prefix\nincoming one\nbetween\nincoming two\nsuffix';
    const [first, second] = parseConflicts(result);
    const ranges = buildMergeSourceRanges([first, second], current, incoming);
    const afterFirst = resolveConflictText(result, first, 'current');
    const [remaining] = parseConflicts(afterFirst);

    expect(ranges.get(remaining.id)?.current).toEqual({ start: current.indexOf('current two'), end: current.indexOf('current two') + 'current two'.length });
    expect(ranges.get(remaining.id)?.incoming).toEqual({ start: incoming.indexOf('incoming two'), end: incoming.indexOf('incoming two') + 'incoming two'.length });
  });
});
