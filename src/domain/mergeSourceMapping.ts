import type { ConflictBlock } from './types';

export interface SourceOffsetRange {
  readonly start: number;
  readonly end: number;
}

export interface SourceBlockRanges {
  readonly current?: SourceOffsetRange;
  readonly incoming?: SourceOffsetRange;
}

/**
 * Establish source locations once when a merge workspace opens. Result edits
 * subsequently remove markers, so re-searching the remaining block text can
 * attach a widget to an earlier, already-resolved occurrence.
 */
export function buildMergeSourceRanges(
  blocks: readonly ConflictBlock[],
  currentText: string,
  incomingText: string,
): ReadonlyMap<string, SourceBlockRanges> {
  const cursors = { current: 0, incoming: 0 };
  const sources = { current: currentText, incoming: incomingText };
  const ranges = new Map<string, SourceBlockRanges>();

  for (const block of blocks) {
    const mapped: { current?: SourceOffsetRange; incoming?: SourceOffsetRange } = {};
    (['current', 'incoming'] as const).forEach((side) => {
      const text = block[side].text;
      if (!text) return;
      const start = sources[side].indexOf(text, cursors[side]);
      if (start < 0) return;
      const end = start + text.length;
      cursors[side] = end;
      mapped[side] = { start, end };
    });
    ranges.set(block.id, mapped);
  }
  return ranges;
}
