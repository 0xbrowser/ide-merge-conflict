/** A complete immutable input of the three-way merge. */
export interface FileVersion {
  readonly kind: 'base' | 'current' | 'incoming';
  readonly label: string;
  readonly ref: string;
  readonly text: string;
}

/** Monaco-compatible, end-exclusive text range. Lines and columns are 1-based. */
export interface ConflictRange {
  readonly startLineNumber: number;
  readonly startColumn: number;
  readonly endLineNumber: number;
  readonly endColumn: number;
}

/** `base` is used by the Merge Editor MVP's Ignore action. */
export type ResolutionChoice = 'current' | 'incoming' | 'both' | 'both-incoming-first' | 'base';

export type ConflictResolutionStatus =
  | 'unresolved'
  | 'resolved-current'
  | 'resolved-incoming'
  | 'resolved-both'
  | 'resolved-base'
  | 'manually-edited';

export interface ConflictSection {
  readonly label: string;
  readonly text: string;
  /** Body only; excludes Git marker lines. */
  readonly range: ConflictRange;
  /** Marker plus body, useful for source-color decoration. */
  readonly decorationRange: ConflictRange;
}

/**
 * The parsed form of one Git conflict. `range` is deliberately the only range
 * accepted by the resolver: it replaces marker-to-marker, not a searched text.
 */
export interface ConflictBlock {
  readonly id: string;
  readonly range: ConflictRange;
  readonly headerRange: ConflictRange;
  readonly separatorRange: ConflictRange;
  readonly footerRange: ConflictRange;
  readonly current: ConflictSection;
  readonly incoming: ConflictSection;
  readonly base?: ConflictSection;
}

export interface ResolvedResult {
  readonly conflictId: string;
  readonly choice: ResolutionChoice;
  readonly text: string;
  readonly status: ConflictResolutionStatus;
}

/** App-level metadata; Monaco owns the actual text undo/redo stack. */
export interface ConflictHistoryEntry {
  readonly conflictId: string;
  readonly choice: ResolutionChoice;
  readonly beforeText: string;
  readonly afterText: string;
}

export interface MergeSession {
  readonly base: FileVersion;
  readonly current: FileVersion;
  readonly incoming: FileVersion;
  readonly initialResult: string;
  readonly conflicts: readonly ConflictBlock[];
  readonly history: readonly ConflictHistoryEntry[];
}
