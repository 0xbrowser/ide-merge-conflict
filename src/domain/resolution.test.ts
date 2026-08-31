import { describe, expect, it } from 'vitest';
import { parseConflicts } from './conflictParser';
import {
  combineBoth,
  resolveConflictText,
} from './resolution';

function firstBlock(text: string) {
  const block = parseConflicts(text)[0];
  if (!block) throw new Error('Expected a conflict block');
  return block;
}

const oneConflict = `before
<<<<<<< HEAD
current line
=======
incoming line
>>>>>>> feature/topic
after
`;

describe('Git conflict resolution', () => {
  it('Accept Current replaces only the full marker range', () => {
    expect(resolveConflictText(oneConflict, firstBlock(oneConflict), 'current')).toBe(`before
current line
after
`);
  });

  it('Accept Incoming replaces only the full marker range', () => {
    expect(resolveConflictText(oneConflict, firstBlock(oneConflict), 'incoming')).toBe(`before
incoming line
after
`);
  });

  it('Accept Both is deterministic: Current then Incoming', () => {
    expect(resolveConflictText(oneConflict, firstBlock(oneConflict), 'both')).toBe(`before
current line
incoming line
after
`);
    expect(combineBoth('current', 'incoming')).toBe('current\nincoming');
  });

  it('Merge Editor supports the inverse Incoming-first combination', () => {
    const expected = ['before', 'incoming line', 'current line', 'after', ''].join('\n');
    expect(resolveConflictText(oneConflict, firstBlock(oneConflict), 'both-incoming-first')).toBe(expected);
  });

  it('reparses a later block at its new post-edit line after resolving the first', () => {
    const text = `top
<<<<<<< HEAD
first current
=======
first incoming
>>>>>>> first
between
<<<<<<< HEAD
second current
=======
second incoming
>>>>>>> second
bottom
`;
    const [first, second] = parseConflicts(text);
    expect(first).toBeDefined();
    expect(second).toBeDefined();

    const afterFirst = resolveConflictText(text, first!, 'current');
    const remaining = firstBlock(afterFirst);
    expect(remaining.headerRange.startLineNumber).toBe(4);
    expect(resolveConflictText(afterFirst, remaining, 'incoming')).toBe(`top
first current
between
second incoming
bottom
`);
  });

  it('handles insertions, deletions, and empty sides without extra blank lines', () => {
    const deletion = `before
<<<<<<< HEAD
||||||| base
old line
=======
new line
>>>>>>> incoming
after
`;
    const insertion = `before
<<<<<<< HEAD
new current line
||||||| base
=======
>>>>>>> incoming
after
`;
    const bothEmpty = `before
<<<<<<< HEAD
=======
>>>>>>> incoming
after
`;

    expect(resolveConflictText(deletion, firstBlock(deletion), 'current')).toBe('before\nafter\n');
    expect(resolveConflictText(deletion, firstBlock(deletion), 'incoming')).toBe('before\nnew line\nafter\n');
    expect(resolveConflictText(insertion, firstBlock(insertion), 'both')).toBe('before\nnew current line\nafter\n');
    expect(resolveConflictText(bothEmpty, firstBlock(bothEmpty), 'both')).toBe('before\nafter\n');
  });

  it('retains base/current/incoming section information and exact line ranges', () => {
    const block = firstBlock(`a
<<<<<<< HEAD
current
||||||| common-ancestor
base
=======
incoming
>>>>>>> feature
b`);

    expect(block.current.text).toBe('current');
    expect(block.base?.text).toBe('base');
    expect(block.incoming.text).toBe('incoming');
    expect(block.range).toMatchObject({ startLineNumber: 2, endLineNumber: 9, endColumn: 1 });
  });

  it('Merge Editor Ignore keeps the base section', () => {
    const text = ['before', '<<<<<<< HEAD', 'current', '||||||| base', 'base', '=======', 'incoming', '>>>>>>> feature', 'after', ''].join('\n');
    expect(resolveConflictText(text, firstBlock(text), 'base')).toBe('before\nbase\nafter\n');
  });
});
