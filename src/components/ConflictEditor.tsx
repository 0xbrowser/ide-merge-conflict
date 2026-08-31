import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { findConflictAtRange, parseConflicts } from '../domain/conflictParser';
import {
  ResolutionStateLedger,
  replacementTextForRange,
  resolveConflictText,
} from '../domain/resolution';
import type { ConflictBlock, ConflictResolutionStatus, ResolutionChoice } from '../domain/types';
import { monaco } from '../monaco';

export interface ConflictEditorSnapshot {
  readonly unresolvedCount: number;
  readonly totalConflicts: number;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly statuses: ReadonlyMap<string, ConflictResolutionStatus>;
}

export interface ConflictEditorHandle {
  undo(): void;
  redo(): void;
  applyResolution(block: ConflictBlock, choice: ResolutionChoice): void;
  getText(): string;
  getModel(): monaco.editor.ITextModel | undefined;
}

interface ConflictEditorProps {
  readonly initialText: string;
  readonly initialBlocks: readonly ConflictBlock[];
  readonly onSnapshot: (snapshot: ConflictEditorSnapshot) => void;
  readonly onCompare: (block: ConflictBlock) => void;
  readonly onContentChange: (text: string) => void;
  readonly onReady: (model: monaco.editor.ITextModel | undefined) => void;
}

function wholeLineRange(model: monaco.editor.ITextModel, lineNumber: number): monaco.Range {
  return new monaco.Range(lineNumber, 1, lineNumber, model.getLineMaxColumn(lineNumber));
}

/** Converts an end-exclusive parser range into full body lines without spilling onto a marker. */
function bodyLineRange(model: monaco.editor.ITextModel, range: ConflictBlock['current']['range']): monaco.Range | undefined {
  const lastLine = range.endColumn === 1 ? range.endLineNumber - 1 : range.endLineNumber;
  if (lastLine < range.startLineNumber) return undefined;
  return new monaco.Range(
    range.startLineNumber,
    1,
    lastLine,
    model.getLineMaxColumn(lastLine),
  );
}

function enableWheelScrolling(editor: monaco.editor.IStandaloneCodeEditor, host: HTMLDivElement): monaco.IDisposable {
  const handleWheel = (event: WheelEvent) => {
    if (event.deltaX === 0 && event.deltaY === 0) return;
    const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight);
    const multiplier = event.deltaMode === 1 ? lineHeight : event.deltaMode === 2 ? editor.getLayoutInfo().height : 1;
    if (event.deltaY !== 0) editor.setScrollTop(editor.getScrollTop() + event.deltaY * multiplier);
    if (event.deltaX !== 0) editor.setScrollLeft(editor.getScrollLeft() + event.deltaX * multiplier);
    event.preventDefault();
    event.stopPropagation();
  };
  host.addEventListener('wheel', handleWheel, { capture: true, passive: false });
  return { dispose: () => host.removeEventListener('wheel', handleWheel, true) };
}

function decorationForBlock(model: monaco.editor.ITextModel, block: ConflictBlock): monaco.editor.IModelDeltaDecoration[] {
  const marker = { isWholeLine: true, className: 'conflict-marker-line' };
  const currentMarker = {
    isWholeLine: true,
    className: 'conflict-current-marker-line',
    afterContentClassName: 'conflict-current-marker-label',
  };
  const incomingMarker = {
    isWholeLine: true,
    className: 'conflict-incoming-marker-line',
    afterContentClassName: 'conflict-incoming-marker-label',
  };
  const current = { isWholeLine: true, className: 'conflict-current-line' };
  const incoming = { isWholeLine: true, className: 'conflict-incoming-line' };
  const base = { isWholeLine: true, className: 'conflict-base-line' };
  const currentBody = bodyLineRange(model, block.current.range);
  const incomingBody = bodyLineRange(model, block.incoming.range);
  const baseBody = block.base ? bodyLineRange(model, block.base.range) : undefined;
  const baseMarker = block.base
    ? wholeLineRange(model, block.base.decorationRange.startLineNumber)
    : undefined;

  return [
    { range: block.headerRange, options: currentMarker },
    { range: block.separatorRange, options: marker },
    { range: block.footerRange, options: incomingMarker },
    ...(baseMarker ? [{ range: baseMarker, options: marker }] : []),
    ...(currentBody ? [{ range: currentBody, options: current }] : []),
    ...(incomingBody ? [{ range: incomingBody, options: incoming }] : []),
    ...(baseBody ? [{ range: baseBody, options: base }] : []),
  ];
}

export const ConflictEditor = forwardRef<ConflictEditorHandle, ConflictEditorProps>(function ConflictEditor(
  { initialText, initialBlocks, onSnapshot, onCompare, onContentChange, onReady },
  ref,
) {
  const host = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | undefined>(undefined);
  const decorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | undefined>(undefined);
  const actionZoneIdsRef = useRef<string[]>([]);
  const ledgerRef = useRef<ResolutionStateLedger | undefined>(undefined);

  const removeActionZones = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (actionZoneIdsRef.current.length === 0) return;
    editor.changeViewZones((accessor) => {
      actionZoneIdsRef.current.forEach((id) => accessor.removeZone(id));
    });
    actionZoneIdsRef.current = [];
  }, []);

  const applyResolutionForBlock = useCallback((requestedBlock: ConflictBlock, choice: ResolutionChoice) => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model || !ledgerRef.current) return;

    const beforeText = model.getValue();
    // The action zone was created from this exact live range. Matching by range
    // keeps identical marker text in different locations independently actionable.
    const block = findConflictAtRange(parseConflicts(beforeText), requestedBlock.range);
    if (!block) return;

    const afterText = resolveConflictText(beforeText, block, choice);
    ledgerRef.current.recordAcceptance(beforeText, afterText, block, choice);

    // This is the key contract: executeEdits (not model.setValue) records the
    // edit in Monaco's undo stack. The paired stops keep one Accept atomic.
    editor.pushUndoStop();
    editor.executeEdits('merge-conflict.accept', [{
      range: block.range,
      text: replacementTextForRange(beforeText, block, choice),
      forceMoveMarkers: true,
    }]);
    editor.pushUndoStop();
    editor.focus();
  }, []);

  const refreshPresentation = useCallback(() => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    const decorations = decorationsRef.current;
    const ledger = ledgerRef.current;
    if (!editor || !model || !decorations || !ledger) return;

    const blocks = parseConflicts(model.getValue());
    onContentChange(model.getValue());
    decorations.set(blocks.flatMap((block) => decorationForBlock(model, block)));
    removeActionZones();

    for (const block of blocks) {
      const domNode = document.createElement('div');
      domNode.className = 'merge-action-widget merge-action-zone';
      domNode.style.pointerEvents = 'auto';
      domNode.setAttribute('role', 'group');
      domNode.setAttribute('aria-label', `Actions for ${block.id}`);

      const choices: Array<[ResolutionChoice, string, string]> = [
        ['current', 'Accept Current', 'current'],
        ['incoming', 'Accept Incoming', 'incoming'],
        ['both', 'Accept Both', 'both'],
      ];
      choices.forEach(([choice, label, className]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `widget-button ${className}`;
        button.textContent = label;
        button.addEventListener('pointerdown', (event) => event.stopPropagation());
        button.addEventListener('mousedown', (event) => event.stopPropagation());
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          applyResolutionForBlock(block, choice);
        });
        domNode.append(button);
      });
      const compare = document.createElement('button');
      compare.type = 'button';
      compare.className = 'widget-button compare';
      compare.textContent = 'Compare Changes';
      compare.addEventListener('pointerdown', (event) => event.stopPropagation());
      compare.addEventListener('mousedown', (event) => event.stopPropagation());
      compare.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        onCompare(block);
      });
      domNode.append(compare);

      editor.changeViewZones((accessor) => {
        const zoneId = accessor.addZone({
          afterLineNumber: Math.max(0, block.headerRange.startLineNumber - 1),
          heightInPx: 27,
          domNode,
          suppressMouseDown: false,
        });
        actionZoneIdsRef.current.push(zoneId);
      });
    }

    onSnapshot({
      unresolvedCount: blocks.length,
      totalConflicts: initialBlocks.length,
      canUndo: model.canUndo(),
      canRedo: model.canRedo(),
      statuses: ledger.stateFor(model.getValue(), blocks),
    });
  }, [applyResolutionForBlock, initialBlocks.length, onCompare, onContentChange, onSnapshot, removeActionZones]);

  useImperativeHandle(ref, () => ({
    undo() {
      editorRef.current?.trigger('merge-conflict.toolbar', 'undo', null);
    },
    redo() {
      editorRef.current?.trigger('merge-conflict.toolbar', 'redo', null);
    },
    applyResolution(block, choice) {
      applyResolutionForBlock(block, choice);
    },
    getText() {
      return editorRef.current?.getModel()?.getValue() ?? initialText;
    },
    getModel() {
      return editorRef.current?.getModel() ?? undefined;
    },
  }), [applyResolutionForBlock, initialText]);

  useEffect(() => {
    if (!host.current) return undefined;
    const model = monaco.editor.createModel(
      initialText,
      'typescript',
      monaco.Uri.parse(`inmemory://merge-result/${crypto.randomUUID()}.ts`),
    );
    const editor = monaco.editor.create(host.current, {
      model,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      lineNumbersMinChars: 3,
      glyphMargin: true,
      fontSize: 13,
      lineHeight: 21,
      padding: { top: 12, bottom: 12 },
      renderLineHighlight: 'all',
      ariaLabel: 'Git conflict result editor',
    });
    editorRef.current = editor;
    const wheelListener = enableWheelScrolling(editor, host.current);
    onReady(model);
    decorationsRef.current = editor.createDecorationsCollection();
    ledgerRef.current = new ResolutionStateLedger(initialText, initialBlocks);
    const listener = model.onDidChangeContent(refreshPresentation);
    refreshPresentation();

    return () => {
      listener.dispose();
      wheelListener.dispose();
      removeActionZones();
      editor.dispose();
      model.dispose();
      onReady(undefined);
      editorRef.current = undefined;
      decorationsRef.current = undefined;
    };
  }, [initialBlocks, initialText, onReady, refreshPresentation, removeActionZones]);

  return <div className="result-editor" ref={host} />;
});
