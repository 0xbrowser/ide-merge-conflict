import type { ConflictBlock, ConflictRange, ConflictSection } from './types';

const CURRENT_MARKER = /^<<<<<<<(?:\s(.*))?$/;
const BASE_MARKER = /^\|\|\|\|\|\|\|(.*)$/;
const SEPARATOR_MARKER = /^=======$/;
const INCOMING_MARKER = /^>>>>>>>(?:\s(.*))?$/;

interface MarkerIndexes {
  readonly header: number;
  readonly base?: number;
  readonly separator: number;
  readonly footer: number;
}

function lineEnd(lines: readonly string[], lineIndex: number): ConflictRange {
  return {
    startLineNumber: lineIndex + 1,
    startColumn: 1,
    endLineNumber: lineIndex + 1,
    endColumn: lines[lineIndex].length + 1,
  };
}

function afterLine(lines: readonly string[], lineIndex: number): Pick<ConflictRange, 'endLineNumber' | 'endColumn'> {
  if (lineIndex < lines.length - 1) {
    return { endLineNumber: lineIndex + 2, endColumn: 1 };
  }
  return { endLineNumber: lineIndex + 1, endColumn: lines[lineIndex].length + 1 };
}

function rangeBetweenLines(lines: readonly string[], startIndex: number, endIndex: number): ConflictRange {
  if (startIndex === endIndex) {
    return { startLineNumber: startIndex + 1, startColumn: 1, endLineNumber: startIndex + 1, endColumn: 1 };
  }
  return {
    startLineNumber: startIndex + 1,
    startColumn: 1,
    endLineNumber: endIndex + 1,
    endColumn: 1,
  };
}

function section(
  lines: readonly string[],
  label: string | undefined,
  markerIndex: number,
  bodyStart: number,
  bodyEnd: number,
): ConflictSection {
  return {
    label: label?.trim() || '(unnamed)',
    text: lines.slice(bodyStart, bodyEnd).join('\n'),
    range: rangeBetweenLines(lines, bodyStart, bodyEnd),
    decorationRange: rangeBetweenLines(lines, markerIndex, bodyEnd),
  };
}

function stableId(lines: readonly string[], indexes: MarkerIndexes): string {
  // The content identity does not include result line numbers, so resolving an
  // earlier block cannot make later unresolved blocks point at stale positions.
  const raw = lines.slice(indexes.header, indexes.footer + 1).join('\n');
  let hash = 2166136261;
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `conflict-${(hash >>> 0).toString(36)}`;
}

function createBlock(lines: readonly string[], indexes: MarkerIndexes): ConflictBlock {
  const headerMatch = lines[indexes.header].match(CURRENT_MARKER);
  const footerMatch = lines[indexes.footer].match(INCOMING_MARKER);
  const currentEnd = indexes.base ?? indexes.separator;
  const base = indexes.base === undefined
    ? undefined
    : section(lines, lines[indexes.base].match(BASE_MARKER)?.[1], indexes.base, indexes.base + 1, indexes.separator);

  return {
    id: stableId(lines, indexes),
    range: {
      startLineNumber: indexes.header + 1,
      startColumn: 1,
      ...afterLine(lines, indexes.footer),
    },
    headerRange: lineEnd(lines, indexes.header),
    separatorRange: lineEnd(lines, indexes.separator),
    footerRange: lineEnd(lines, indexes.footer),
    current: section(lines, headerMatch?.[1], indexes.header, indexes.header + 1, currentEnd),
    incoming: section(lines, footerMatch?.[1], indexes.separator, indexes.separator + 1, indexes.footer),
    base,
  };
}

/**
 * Parses well-formed, non-nested Git conflict markers. Malformed/nested blocks
 * are intentionally left untouched so a user never loses ambiguous content.
 */
export function parseConflicts(text: string): ConflictBlock[] {
  const lines = text.split('\n');
  const conflicts: ConflictBlock[] = [];
  let header: number | undefined;
  let base: number | undefined;
  let separator: number | undefined;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (CURRENT_MARKER.test(line)) {
      // A nested header invalidates the partial block, but it can start a new one.
      header = lineIndex;
      base = undefined;
      separator = undefined;
      continue;
    }
    if (header === undefined) continue;

    if (base === undefined && separator === undefined && BASE_MARKER.test(line)) {
      base = lineIndex;
    } else if (separator === undefined && SEPARATOR_MARKER.test(line)) {
      separator = lineIndex;
    } else if (separator !== undefined && INCOMING_MARKER.test(line)) {
      conflicts.push(createBlock(lines, { header, base, separator, footer: lineIndex }));
      header = undefined;
      base = undefined;
      separator = undefined;
    }
  }

  return conflicts;
}

/**
 * A range is unique within one parsed model value. UI actions use it as their
 * live locator instead of using the marker-content hash in ConflictBlock.id.
 */
export function findConflictAtRange(
  blocks: readonly ConflictBlock[],
  range: ConflictRange,
): ConflictBlock | undefined {
  return blocks.find((block) => (
    block.range.startLineNumber === range.startLineNumber
    && block.range.startColumn === range.startColumn
    && block.range.endLineNumber === range.endLineNumber
    && block.range.endColumn === range.endColumn
  ));
}

export function rangeToOffsets(text: string, range: ConflictRange): { start: number; end: number } {
  const lines = text.split('\n');
  const offsetAt = (lineNumber: number, column: number): number => {
    const before = lines.slice(0, lineNumber - 1).reduce((total, line) => total + line.length + 1, 0);
    return before + column - 1;
  };
  return {
    start: offsetAt(range.startLineNumber, range.startColumn),
    end: offsetAt(range.endLineNumber, range.endColumn),
  };
}
