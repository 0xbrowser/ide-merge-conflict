import type { ConflictBlock, ResolutionChoice } from './types';

export interface AiProposal {
  readonly choice: ResolutionChoice;
  readonly title: string;
  readonly explanation: string;
}

/** Offline, deterministic stand-in for an AI recommendation. */
export function proposeResolution(block: ConflictBlock): AiProposal {
  const base = block.base?.text ?? '';
  if (block.current.text === base && block.incoming.text !== base) {
    return { choice: 'incoming', title: 'Keep incoming change', explanation: 'Current matches Base; Incoming is the only changed side.' };
  }
  if (block.incoming.text === base && block.current.text !== base) {
    return { choice: 'current', title: 'Keep current change', explanation: 'Incoming matches Base; Current is the only changed side.' };
  }
  return {
    choice: 'both',
    title: 'Review a combination',
    explanation: 'Both sides differ from Base. The local demo proposes Current → Incoming, but this is text-level only and needs review.',
  };
}
