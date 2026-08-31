import { rangeToOffsets } from './conflictParser';
import type {
  ConflictBlock,
  ConflictResolutionStatus,
  ResolvedResult,
  ResolutionChoice,
} from './types';

export function statusForChoice(choice: ResolutionChoice): ConflictResolutionStatus {
  if (choice === 'both-incoming-first') return 'resolved-both';
  return `resolved-${choice}`;
}

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

  return { conflictId: block.id, choice, text, status: statusForChoice(choice) };
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

/**
 * Stores view metadata for exact editor values. On an undo/redo Monaco restores
 * an earlier value, so this ledger restores the matching conflict status too.
 */
export class ResolutionStateLedger {
  private readonly statesByText = new Map<string, ReadonlyMap<string, ConflictResolutionStatus>>();

  constructor(initialText: string, blocks: readonly ConflictBlock[]) {
    this.statesByText.set(initialText, new Map(blocks.map((block) => [block.id, 'unresolved'])));
  }

  recordAcceptance(
    beforeText: string,
    afterText: string,
    block: ConflictBlock,
    choice: ResolutionChoice,
  ): void {
    const before = this.statesByText.get(beforeText) ?? new Map<string, ConflictResolutionStatus>();
    const next = new Map(before);
    next.set(block.id, statusForChoice(choice));
    this.statesByText.set(afterText, next);
  }

  stateFor(text: string, unresolvedBlocks: readonly ConflictBlock[]): ReadonlyMap<string, ConflictResolutionStatus> {
    const known = this.statesByText.get(text);
    if (known) return known;
    // For a manual edit only unambiguous marker blocks remain "unresolved".
    return new Map(unresolvedBlocks.map((block) => [block.id, 'unresolved']));
  }
}
