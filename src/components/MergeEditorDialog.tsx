import { useEffect, useMemo, useRef } from 'react';
import { parseConflicts } from '../domain/conflictParser';
import { buildMergeSourceRanges, type SourceBlockRanges } from '../domain/mergeSourceMapping';
import type { ConflictBlock, MergeSession, ResolutionChoice } from '../domain/types';
import { monaco } from '../monaco';

interface MergeEditorDialogProps {
  readonly resultText: string;
  readonly resultModel: monaco.editor.ITextModel;
  readonly session: MergeSession;
  readonly onApply: (block: ConflictBlock, choice: ResolutionChoice) => void;
  readonly onClose: () => void;
}

type MergeEditor = monaco.editor.IStandaloneCodeEditor;

function sourceRange(model: monaco.editor.ITextModel, blockId: string, side: 'current' | 'incoming', sourceRanges: ReadonlyMap<string, SourceBlockRanges>): monaco.Range | undefined {
  const offsets = sourceRanges.get(blockId)?.[side];
  if (!offsets) return undefined;
  const start = model.getPositionAt(offsets.start);
  const end = model.getPositionAt(offsets.end);
  return new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column);
}

function addActions(editor: MergeEditor, blocks: readonly ConflictBlock[], side: 'current' | 'incoming', sourceRanges: ReadonlyMap<string, SourceBlockRanges>, onApply: MergeEditorDialogProps['onApply']): monaco.IDisposable[] {
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
    addButton(
      `Accept Combination (${side === 'current' ? 'Current' : 'Incoming'} First)`,
      side === 'current' ? 'both' : 'both-incoming-first',
    );
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

export function MergeEditorDialog({ resultText, resultModel, session, onApply, onClose }: MergeEditorDialogProps) {
  const incomingHost = useRef<HTMLDivElement>(null);
  const currentHost = useRef<HTMLDivElement>(null);
  const resultHost = useRef<HTMLDivElement>(null);
  const blocks = useMemo(() => parseConflicts(resultText), [resultText]);

  useEffect(() => {
    if (!incomingHost.current || !currentHost.current || !resultHost.current) return undefined;
    const incomingModel = monaco.editor.createModel(session.incoming.text, 'typescript', monaco.Uri.parse(`inmemory://merge-workspace/${crypto.randomUUID()}/incoming.ts`));
    const currentModel = monaco.editor.createModel(session.current.text, 'typescript', monaco.Uri.parse(`inmemory://merge-workspace/${crypto.randomUUID()}/current.ts`));
    const options: monaco.editor.IStandaloneEditorConstructionOptions = {
      automaticLayout: true, readOnly: true, minimap: { enabled: false }, scrollBeyondLastLine: false,
      lineNumbersMinChars: 3, fontSize: 13, lineHeight: 20, padding: { top: 34, bottom: 10 }, renderLineHighlight: 'all',
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

    return () => {
      modelListener.dispose();
      scrollListeners.forEach((item) => item.dispose());
      widgets.forEach((item) => item.dispose());
      incomingDecorations.clear(); currentDecorations.clear();
      resultDecorations.clear();
      incoming.dispose(); current.dispose(); result.dispose();
      incomingModel.dispose(); currentModel.dispose();
    };
  }, [onApply, resultModel, session]);

  return <div className="modal-backdrop merge-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="merge-modal merge-workspace" role="dialog" aria-modal="true" aria-labelledby="merge-editor-title" onMouseDown={(event) => event.stopPropagation()}>
      <header className="compare-header"><div><p className="eyebrow">Merge Editor MVP</p><h2 id="merge-editor-title">Incoming · Current · Result</h2><p>Scroll any pane to synchronize the other views. Base is used for the per-block Ignore action.</p></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close merge editor">×</button></header>
      <div className="merge-summary"><span>{blocks.length} conflicts remaining</span><span>Incoming (left) · Current (right) · Result (bottom)</span></div>
      <div className="merge-editor-grid">
        <section className="merge-editor-panel"><header>Incoming <span>{session.incoming.ref}</span></header><div ref={incomingHost} /></section>
        <section className="merge-editor-panel"><header>Current <span>{session.current.ref}</span></header><div ref={currentHost} /></section>
        <section className="merge-editor-panel result"><header>Result <span>{blocks.length} conflicts remaining</span></header><div ref={resultHost} /></section>
      </div>
    </section>
  </div>;
}
