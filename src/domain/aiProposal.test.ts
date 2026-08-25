import { describe, expect, it } from 'vitest';
import { proposeResolution } from './aiProposal';
import { parseConflicts } from './conflictParser';

describe('proposeResolution', () => {
  it('keeps the only side that differs from base', () => {
    const [block] = parseConflicts([
      '<<<<<<< HEAD', 'same', '||||||| base', 'same', '=======', 'changed', '>>>>>>> feature',
    ].join('\n'));
    expect(proposeResolution(block).choice).toBe('incoming');
  });

  it('requests review when both sides differ', () => {
    const [block] = parseConflicts([
      '<<<<<<< HEAD', 'current', '||||||| base', 'base', '=======', 'incoming', '>>>>>>> feature',
    ].join('\n'));
    expect(proposeResolution(block)).toMatchObject({ choice: 'both', title: 'Review a combination' });
  });
});
