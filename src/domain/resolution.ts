import { rangeToOffsets } from './conflictParser';
import type {
  ConflictBlock,
  ResolvedResult,
  ResolutionChoice,
} from './types';

/** Stable, intentionally non-smart inline "Both" semantics: Current then Incoming. */
export function combineBoth(current: string, incoming: string): string {
  if (!current) return incoming;
  if (!incoming) return current;
  return `${current}\n${incoming}`;
}

export function resolvedResult(block: ConflictBlock, choice: ResolutionChoice): ResolvedResult {
  const text = choice === 'current'
    ? block.current.text
    : choice === 'incoming'
      ? block.incoming.text
      : choice === 'base'
        ? block.base?.text ?? ''
        : choice === 'both-incoming-first'
          ? combineBoth(block.incoming.text, block.current.text)
          : combineBoth(block.current.text, block.incoming.text);

  return { conflictId: block.id, choice, text };
}

/**
 * A full marker range contains the footer's following line break when there is
 * another line. Preserve that separator after a non-empty replacement, while a
 * deletion intentionally leaves no empty line behind.
 */
export function replacementTextForRange(text: string, block: ConflictBlock, choice: ResolutionChoice): string {
  const replacement = resolvedResult(block, choice).text;
  const { start, end } = rangeToOffsets(text, block.range);
  return replacement && text.slice(start, end).endsWith('\n') ? `${replacement}\n` : replacement;
}

/** A pure equivalent of the single Monaco edit used by the UI. */
export function resolveConflictText(text: string, block: ConflictBlock, choice: ResolutionChoice): string {
  const { start, end } = rangeToOffsets(text, block.range);
  return `${text.slice(0, start)}${replacementTextForRange(text, block, choice)}${text.slice(end)}`;
}
