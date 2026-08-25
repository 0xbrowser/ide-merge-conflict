import {
  IconBrandTypescript,
  IconChevronLeft,
  IconDots,
  IconLoader2,
  IconPlus,
  IconSettings,
  IconThumbDown,
  IconX,
} from '@tabler/icons-react';

interface AiResolutionDialogProps {
  readonly onClose: () => void;
}

export function AiResolutionDialog({ onClose }: AiResolutionDialogProps) {
  return (
    <aside className="ai-side-panel" role="complementary" aria-label="AI conflict resolution">
      <header className="ai-panel-topbar">
        <span className="ai-panel-title">CHAT</span>
        <div className="ai-panel-actions">
          <button type="button" aria-label="New chat"><IconPlus size={15} /></button>
          <button type="button" aria-label="AI settings"><IconSettings size={15} /></button>
          <button type="button" aria-label="More chat actions"><IconDots size={15} /></button>
          <button type="button" aria-label="Close AI assistant" onClick={onClose}><IconX size={15} /></button>
        </div>
      </header>

      <div className="ai-thread-heading">
        <button type="button" onClick={onClose}><IconChevronLeft size={14} /><strong>RESOLVE ALL MERGE CONFLICTS</strong></button>
        <span aria-hidden="true">◫</span>
      </div>

      <div className="ai-panel-messages">
        <div className="ai-file-chip"><IconBrandTypescript size={12} /><span>sampleDocument.ts</span></div>
        <div className="ai-user-message">Resolve all merge conflicts</div>
        <div className="ai-loading-card">
          <IconLoader2 className="ai-loading-icon" size={18} />
          <div><strong>Analyzing merge conflicts</strong><span>Inspecting Base, Current, and Incoming changes…</span></div>
        </div>
        <div className="ai-loading-lines" aria-label="AI is loading">
          <span /><span /><span />
        </div>
        <div className="ai-loading-status"><IconLoader2 className="ai-loading-icon" size={14} /> Preparing a resolution suggestion</div>
      </div>

      <footer className="ai-panel-composer">
        <div className="ai-composer-box">
          <div className="ai-composer-context"><IconPlus size={14} /><IconBrandTypescript size={13} /><span>sampleDocument.ts</span></div>
          <span className="ai-composer-placeholder">Describe what to build</span>
          <div className="ai-composer-actions"><span>＋</span><span>⌁</span><span>Models</span><span>☷</span><IconThumbDown size={13} /></div>
        </div>
        <div className="ai-panel-footer"><span>Local</span><span>Default Approvals</span><span>↵</span></div>
      </footer>
    </aside>
  );
}
