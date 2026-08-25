import { useEffect, useRef } from 'react';
import { monaco } from '../monaco';

interface CompareEditorTabProps {
  readonly currentText: string;
  readonly incomingText: string;
}

export function CompareEditorTab({ currentText, incomingText }: CompareEditorTabProps) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return undefined;

    const currentModel = monaco.editor.createModel(
      currentText,
      'typescript',
      monaco.Uri.parse(`inmemory://compare-tab/${crypto.randomUUID()}/current.ts`),
    );
    const incomingModel = monaco.editor.createModel(
      incomingText,
      'typescript',
      monaco.Uri.parse(`inmemory://compare-tab/${crypto.randomUUID()}/incoming.ts`),
    );
    const editor = monaco.editor.createDiffEditor(host.current, {
      automaticLayout: true,
      enableSplitViewResizing: true,
      fontSize: 13,
      lineHeight: 21,
      minimap: { enabled: false },
      originalEditable: false,
      readOnly: true,
      renderIndicators: true,
      renderOverviewRuler: true,
      renderSideBySide: true,
      scrollBeyondLastLine: false,
      scrollbar: {
        horizontalScrollbarSize: 8,
        verticalScrollbarSize: 8,
      },
    });
    editor.setModel({ original: currentModel, modified: incomingModel });

    const originalEditor = editor.getOriginalEditor();
    const modifiedEditor = editor.getModifiedEditor();
    let syncing = false;
    let releaseFrame = 0;
    const syncScroll = (target: monaco.editor.IStandaloneCodeEditor, event: monaco.IScrollEvent) => {
      if (syncing || (!event.scrollTopChanged && !event.scrollLeftChanged)) return;
      syncing = true;
      if (event.scrollTopChanged) target.setScrollTop(event.scrollTop);
      if (event.scrollLeftChanged) target.setScrollLeft(event.scrollLeft);
      cancelAnimationFrame(releaseFrame);
      releaseFrame = requestAnimationFrame(() => {
        syncing = false;
      });
    };
    const originalScrollListener = originalEditor.onDidScrollChange((event) => {
      syncScroll(modifiedEditor, event);
    });
    const modifiedScrollListener = modifiedEditor.onDidScrollChange((event) => {
      syncScroll(originalEditor, event);
    });

    return () => {
      cancelAnimationFrame(releaseFrame);
      originalScrollListener.dispose();
      modifiedScrollListener.dispose();
      editor.dispose();
      currentModel.dispose();
      incomingModel.dispose();
    };
  }, [currentText, incomingText]);

  return (
    <div className="compare-editor-tab-view" aria-label="Current and incoming changes comparison">
      <div className="compare-pane-labels" aria-hidden="true">
        <span>Current Changes</span>
        <span>Incoming Changes</span>
      </div>
      <div className="compare-editor-surface" ref={host} />
    </div>
  );
}
