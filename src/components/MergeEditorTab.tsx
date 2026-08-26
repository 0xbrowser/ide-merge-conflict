import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { parseConflicts } from '../domain/conflictParser';
import { buildMergeSourceRanges, type SourceBlockRanges } from '../domain/mergeSourceMapping';
import type { ConflictBlock, MergeSession, ResolutionChoice } from '../domain/types';
import { monaco } from '../monaco';

interface MergeEditorTabProps {
  readonly resultText: string;
  readonly resultModel: monaco.editor.ITextModel;
  readonly session: MergeSession;
  readonly onApply: (block: ConflictBlock, choice: ResolutionChoice) => void;
}

type MergeEditor = monaco.editor.IStandaloneCodeEditor;
type SplitAxis = 'column' | 'row';

function sourceRange(model: monaco.editor.ITextModel, blockId: string, side: 'current' | 'incoming', sourceRanges: ReadonlyMap<string, SourceBlockRanges>): monaco.Range | undefined {
  const offsets = sourceRanges.get(blockId)?.[side];
  if (!offsets) return undefined;
  const start = model.getPositionAt(offsets.start);
  const end = model.getPositionAt(offsets.end);
  return new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column);
}

function addActions(editor: MergeEditor, blocks: readonly ConflictBlock[], side: 'current' | 'incoming', sourceRanges: ReadonlyMap<string, SourceBlockRanges>, onApply: MergeEditorTabProps['onApply']): monaco.IDisposable[] {
  return blocks.flatMap((block) => {
    const range = sourceRange(editor.getModel()!, block.id, side, sourceRanges);
    if (!range) return [];
    const node = document.createElement('div');
    node.className = `merge-code-lens ${side}`;
    const addButton = (label: string, choice: ResolutionChoice) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', () => onApply(block, choice));
      node.append(button);
    };
    addButton(side === 'current' ? 'Accept Current' : 'Accept Incoming', side);
    addButton('Accept Both', side === 'current' ? 'both' : 'both-incoming-first');
    addButton('Ignore', 'base');
    const widget: monaco.editor.IContentWidget = {
      getId: () => `merge-editor-${side}-${block.id}`,
      getDomNode: () => node,
      getPosition: () => ({ position: range.getStartPosition(), preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE] }),
      allowEditorOverflow: true,
    };
    editor.addContentWidget(widget);
    return [{ dispose: () => editor.removeContentWidget(widget) }];
  });
}

function sourceDecorations(editor: MergeEditor, blocks: readonly ConflictBlock[], side: 'current' | 'incoming', sourceRanges: ReadonlyMap<string, SourceBlockRanges>): monaco.editor.IModelDeltaDecoration[] {
  const model = editor.getModel()!;
  return blocks.flatMap((block) => {
    const range = sourceRange(model, block.id, side, sourceRanges);
    if (!range) return [];
    return [{ range, options: { isWholeLine: true, className: `merge-hunk-${side}` } }];
  });
}

function syncScrolling(editors: readonly MergeEditor[]): monaco.IDisposable[] {
  let syncing = false;
  return editors.map((source) => source.onDidScrollChange((event) => {
    if (syncing || !event.scrollTopChanged) return;
    const sourceMax = Math.max(1, source.getScrollHeight() - source.getLayoutInfo().height);
    const ratio = source.getScrollTop() / sourceMax;
    syncing = true;
    editors.filter((target) => target !== source).forEach((target) => {
      const targetMax = Math.max(0, target.getScrollHeight() - target.getLayoutInfo().height);
      target.setScrollTop(ratio * targetMax);
    });
    queueMicrotask(() => { syncing = false; });
  }));
}

function enableWheelScrolling(editors: readonly { editor: MergeEditor; host: HTMLDivElement }[], workspace: HTMLDivElement): monaco.IDisposable {
  const handleWheel = (event: WheelEvent) => {
    if (event.deltaX === 0 && event.deltaY === 0) return;
    const target = event.target as Node | null;
    const panel = target instanceof Element ? target.closest('.merge-tab-panel') : null;
    const entry = editors.find(({ host }) => (
      (target !== null && host.contains(target))
      || (panel !== null && host.closest('.merge-tab-panel') === panel)
    ));
    if (!entry) return;
    const { editor } = entry;
    const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight);
    const multiplier = event.deltaMode === 1 ? lineHeight : event.deltaMode === 2 ? editor.getLayoutInfo().height : 1;
    if (event.deltaY !== 0) editor.setScrollTop(editor.getScrollTop() + event.deltaY * multiplier);
    if (event.deltaX !== 0) editor.setScrollLeft(editor.getScrollLeft() + event.deltaX * multiplier);
    event.preventDefault();
    event.stopPropagation();
  };
  workspace.addEventListener('wheel', handleWheel, { capture: true, passive: false });
  return { dispose: () => workspace.removeEventListener('wheel', handleWheel, true) };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function MergeEditorTab({ resultText, resultModel, session, onApply }: MergeEditorTabProps) {
  const incomingHost = useRef<HTMLDivElement>(null);
  const currentHost = useRef<HTMLDivElement>(null);
  const resultHost = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const dragAxis = useRef<SplitAxis | undefined>(undefined);
  const splitRef = useRef({ column: 50, row: 50 });
  const dragFrame = useRef<number | undefined>(undefined);
  const [split, setSplit] = useState({ column: 50, row: 50 });
  const blocks = useMemo(() => parseConflicts(resultText), [resultText]);

  useEffect(() => {
    if (!incomingHost.current || !currentHost.current || !resultHost.current) return undefined;
    const incomingModel = monaco.editor.createModel(session.incoming.text, 'typescript', monaco.Uri.parse(`inmemory://merge-workspace/${crypto.randomUUID()}/incoming.ts`));
    const currentModel = monaco.editor.createModel(session.current.text, 'typescript', monaco.Uri.parse(`inmemory://merge-workspace/${crypto.randomUUID()}/current.ts`));
    const options: monaco.editor.IStandaloneEditorConstructionOptions = {
      automaticLayout: true, readOnly: true, minimap: { enabled: false }, scrollBeyondLastLine: false,
      lineNumbersMinChars: 3, fontSize: 13, lineHeight: 20, padding: { top: 34, bottom: 10 }, renderLineHighlight: 'all',
      mouseWheelScrollSensitivity: 1,
      fastScrollSensitivity: 5,
      scrollbar: {
        alwaysConsumeMouseWheel: false,
        handleMouseWheel: true,
        horizontalScrollbarSize: 8,
        verticalScrollbarSize: 10,
      },
    };
    const incoming = monaco.editor.create(incomingHost.current, { ...options, model: incomingModel, ariaLabel: 'Incoming merge input' });
    const current = monaco.editor.create(currentHost.current, { ...options, model: currentModel, ariaLabel: 'Current merge input' });
    const result = monaco.editor.create(resultHost.current, { ...options, model: resultModel, readOnly: false, ariaLabel: 'Merge result' });
    const sourceRanges = buildMergeSourceRanges(parseConflicts(resultModel.getValue()), session.current.text, session.incoming.text);
    const incomingDecorations = incoming.createDecorationsCollection();
    const currentDecorations = current.createDecorationsCollection();
    const resultDecorations = result.createDecorationsCollection();
    let widgets: monaco.IDisposable[] = [];
    const refreshPresentation = () => {
      const liveBlocks = parseConflicts(resultModel.getValue());
      incomingDecorations.set(sourceDecorations(incoming, liveBlocks, 'incoming', sourceRanges));
      currentDecorations.set(sourceDecorations(current, liveBlocks, 'current', sourceRanges));
      resultDecorations.set(liveBlocks.map((block) => ({ range: new monaco.Range(block.range.startLineNumber, 1, block.range.endLineNumber, 1), options: { isWholeLine: true, className: 'merge-hunk-result' } })));
      widgets.forEach((item) => item.dispose());
      widgets = [...addActions(incoming, liveBlocks, 'incoming', sourceRanges, onApply), ...addActions(current, liveBlocks, 'current', sourceRanges, onApply)];
    };
    refreshPresentation();
    const modelListener = resultModel.onDidChangeContent(refreshPresentation);
    const scrollListeners = syncScrolling([incoming, current, result]);
    const wheelListener = workspaceRef.current
      ? enableWheelScrolling([
        { editor: incoming, host: incomingHost.current },
        { editor: current, host: currentHost.current },
        { editor: result, host: resultHost.current },
      ], workspaceRef.current)
      : undefined;

    return () => {
      modelListener.dispose();
      scrollListeners.forEach((item) => item.dispose());
      wheelListener?.dispose();
      widgets.forEach((item) => item.dispose());
      incomingDecorations.clear(); currentDecorations.clear();
      resultDecorations.clear();
      incoming.dispose(); current.dispose(); result.dispose();
      incomingModel.dispose(); currentModel.dispose();
    };
  }, [onApply, resultModel, session]);

  useEffect(() => () => {
    if (dragFrame.current !== undefined) cancelAnimationFrame(dragFrame.current);
  }, []);

  const applySplitToDom = (next: typeof splitRef.current) => {
    workspaceRef.current?.style.setProperty('--merge-column-split', `${next.column}%`);
    workspaceRef.current?.style.setProperty('--merge-row-split', `${next.row}%`);
  };

  const startDrag = (axis: SplitAxis) => (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragAxis.current = axis;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDrag = (event: PointerEvent<HTMLDivElement>) => {
    const axis = dragAxis.current;
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!axis || !rect) return;
    const next = { ...splitRef.current };
    if (axis === 'column') {
      next.column = clamp(((event.clientX - rect.left) / rect.width) * 100, 25, 75);
    } else {
      next.row = clamp(((event.clientY - rect.top) / rect.height) * 100, 25, 72);
    }
    splitRef.current = next;
    if (dragFrame.current === undefined) {
      dragFrame.current = requestAnimationFrame(() => {
        dragFrame.current = undefined;
        applySplitToDom(splitRef.current);
      });
    }
  };

  const stopDrag = () => {
    if (dragFrame.current !== undefined) {
      cancelAnimationFrame(dragFrame.current);
      dragFrame.current = undefined;
    }
    applySplitToDom(splitRef.current);
    setSplit(splitRef.current);
    dragAxis.current = undefined;
  };

  const workspaceStyle = {
    '--merge-column-split': `${split.column}%`,
    '--merge-row-split': `${split.row}%`,
  } as CSSProperties;

  return <div
    ref={workspaceRef}
    className="merge-tab-workspace"
    style={workspaceStyle}
    onPointerMove={handleDrag}
    onPointerUp={stopDrag}
    onPointerCancel={stopDrag}
  >
    <div className="merge-tab-summary">
      <span><b>{blocks.length}</b> conflicts remaining</span>
      <span>Drag the dividers to resize panes · Scroll any pane to synchronize the others</span>
    </div>
    <div className="merge-tab-grid">
      <section className="merge-tab-panel incoming"><header>Incoming <span>{session.incoming.ref}</span></header><div ref={incomingHost} /></section>
      <div className="merge-resize-handle merge-resize-column" role="separator" aria-label="Resize incoming and current panes" aria-orientation="vertical" onPointerDown={startDrag('column')} />
      <section className="merge-tab-panel current"><header>Current <span>{session.current.ref}</span></header><div ref={currentHost} /></section>
      <section className="merge-tab-panel result"><header>Result <span>{blocks.length} conflicts remaining</span></header><div ref={resultHost} /></section>
      <div className="merge-resize-handle merge-resize-row" role="separator" aria-label="Resize source and result panes" aria-orientation="horizontal" onPointerDown={startDrag('row')} />
    </div>
  </div>;
}
