import { describe, expect, it } from 'vitest';
import { findConflictAtRange, parseConflicts, rangeToOffsets } from './conflictParser';

describe('parseConflicts', () => {
  it('returns every well-formed non-nested block and leaves malformed markers alone', () => {
    const text = `<<<<<<< HEAD
a
=======
b
>>>>>>> one
plain
<<<<<<< malformed
no separator
`;
    const conflicts = parseConflicts(text);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].current.label).toBe('HEAD');
    expect(conflicts[0].incoming.label).toBe('one');
  });

  it('maps the marker-to-marker end-exclusive range into correct source offsets', () => {
    const text = `pre
<<<<<<< HEAD
a
=======
b
>>>>>>> branch
post`;
    const [block] = parseConflicts(text);
    const offsets = rangeToOffsets(text, block.range);
    expect(text.slice(offsets.start, offsets.end)).toBe(`<<<<<<< HEAD
a
=======
b
>>>>>>> branch
`);
  });

  it('locates identical marker blocks by their live ranges, not their content id', () => {
    const blockText = [
      '<<<<<<< HEAD',
      'same current',
      '=======',
      'same incoming',
      '>>>>>>> feature',
    ].join('\n');
    const blocks = parseConflicts(`${blockText}\nplain\n${blockText}\n`);

    expect(blocks).toHaveLength(2);
    expect(blocks[0].id).toBe(blocks[1].id);
    expect(findConflictAtRange(blocks, blocks[1].range)).toBe(blocks[1]);
  });
});
