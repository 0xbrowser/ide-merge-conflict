import { useEffect, useRef } from 'react';
import { monaco } from '../monaco';
import type { ConflictBlock } from '../domain/types';

interface CompareDialogProps {
  readonly block: ConflictBlock;
  readonly onClose: () => void;
}

export function CompareDialog({ block, onClose }: CompareDialogProps) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return undefined;
    const currentModel = monaco.editor.createModel(
      block.current.text,
      'typescript',
      monaco.Uri.parse(`inmemory://compare/${block.id}/current.ts`),
    );
    const incomingModel = monaco.editor.createModel(
      block.incoming.text,
      'typescript',
      monaco.Uri.parse(`inmemory://compare/${block.id}/incoming.ts`),
    );
    const editor = monaco.editor.createDiffEditor(host.current, {
      automaticLayout: true,
      minimap: { enabled: false },
      readOnly: true,
      originalEditable: false,
      renderSideBySide: true,
      renderIndicators: true,
      scrollBeyondLastLine: false,
      fontSize: 13,
      lineHeight: 20,
    });
    editor.setModel({ original: currentModel, modified: incomingModel });

    return () => {
      editor.dispose();
      currentModel.dispose();
      incomingModel.dispose();
    };
  }, [block]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="compare-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="compare-header">
          <div>
            <p className="eyebrow">Conflict comparison</p>
            <h2 id="compare-title">Current ↔ Incoming</h2>
            <p>{block.current.label} on the left, {block.incoming.label} on the right.</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close comparison">×</button>
        </header>
        <div className="compare-labels"><span>Current · {block.current.label}</span><span>Incoming · {block.incoming.label}</span></div>
        <div className="compare-editor" ref={host} />
      </section>
    </div>
  );
}
