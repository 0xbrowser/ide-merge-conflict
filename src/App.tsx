import { useCallback, useRef, useState } from 'react';
import { CompareEditorTab } from './components/CompareEditorTab';
import { AiResolutionDialog } from './components/AiResolutionDialog';
import { MergeEditorTab } from './components/MergeEditorTab';
import {
  ConflictEditor,
  type ConflictEditorHandle,
  type ConflictEditorSnapshot,
} from './components/ConflictEditor';
import { SourceEditor } from './components/SourceEditor';
import { sampleSession } from './domain/sampleDocument';
import type { ConflictBlock, ResolutionChoice } from './domain/types';
import { monaco } from './monaco';
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBrandTypescript,
  IconBraces,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconDots,
  IconFolderOpen,
  IconGitBranch,
  IconGitMerge,
  IconHash,
  IconLayoutColumns,
  IconMarkdown,
  IconPackages,
  IconPlayerPlay,
  IconPlus,
  IconCircleFilled,
  IconSearch,
  IconSettings,
  IconUserCircle,
  IconX,
} from '@tabler/icons-react';

const initialSnapshot: ConflictEditorSnapshot = {
  unresolvedCount: sampleSession.conflicts.length,
  totalConflicts: sampleSession.conflicts.length,
  canUndo: false,
  canRedo: false,
  historyLength: 0,
  statuses: new Map(sampleSession.conflicts.map((block) => [block.id, 'unresolved'])),
};

const sourceComparisons = {
  base: [sampleSession.current.text, sampleSession.incoming.text],
  current: [sampleSession.base.text],
  incoming: [sampleSession.base.text],
} as const;

type MergeInputTab = keyof typeof sourceComparisons;
type EditorTab = 'result' | MergeInputTab | 'compare' | 'merge';

const compareTabLabel = 'sampleDocument.ts: Current Changes ↔ Incoming Changes';

const mergeInputTabs: Array<{ key: MergeInputTab; label: string; ref: string; tone: MergeInputTab }> = [
  { key: 'base', label: 'sampleDocument.ts (base)', ref: sampleSession.base.ref, tone: 'base' },
  { key: 'current', label: 'sampleDocument.ts (current)', ref: sampleSession.current.ref, tone: 'current' },
  { key: 'incoming', label: 'sampleDocument.ts (incoming)', ref: sampleSession.incoming.ref, tone: 'incoming' },
];

export default function App() {
  const editorRef = useRef<ConflictEditorHandle>(null);
  const [snapshot, setSnapshot] = useState<ConflictEditorSnapshot>(initialSnapshot);
  const [compareBlock, setCompareBlock] = useState<ConflictBlock>();
  const [sessionRevision, setSessionRevision] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [resultText, setResultText] = useState(sampleSession.initialResult);
  const [mergeEditorOpen, setMergeEditorOpen] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [resultModel, setResultModel] = useState<monaco.editor.ITextModel>();
  const [activeEditorTab, setActiveEditorTab] = useState<EditorTab>('result');
  const activeSourceTab = mergeInputTabs.find((tab) => tab.key === activeEditorTab);
  const openCompare = useCallback((block: ConflictBlock) => {
    setCompareBlock(block);
    setActiveEditorTab('compare');
  }, []);
  const closeCompare = useCallback(() => {
    setCompareBlock(undefined);
    setActiveEditorTab('result');
  }, []);
  const openMergeEditor = useCallback(() => {
    setMergeEditorOpen(true);
    setActiveEditorTab('merge');
  }, []);
  const closeMergeEditor = useCallback(() => {
    setMergeEditorOpen(false);
    setActiveEditorTab('result');
  }, []);

  const handleSnapshot = useCallback((next: ConflictEditorSnapshot) => {
    setSnapshot(next);
    if (next.unresolvedCount > 0) setCompleted(false);
  }, []);

  const reset = () => {
    setCompleted(false);
    setSnapshot(initialSnapshot);
    setResultText(sampleSession.initialResult);
    // A new model is intentional for a sample reset. Accept itself always uses
    // executeEdits, preserving the undo stack of the active merge session.
    setSessionRevision((revision) => revision + 1);
  };

  const applyWorkspaceChoice = useCallback((block: ConflictBlock, choice: ResolutionChoice) => {
    editorRef.current?.applyResolution(block, choice);
  }, []);

  const unresolvedLabel = `${snapshot.unresolvedCount}/${snapshot.totalConflicts} conflicts remaining`;

  return (
    <div className={`app-shell vscode-shell ${aiAssistantOpen ? 'ai-panel-open' : ''}`}>
      <header className="vscode-titlebar">
        <div className="titlebar-navigation">
          <button className="titlebar-icon" type="button" aria-label="Back"><IconChevronLeft size={16} stroke={1.6} /></button>
          <button className="titlebar-icon" type="button" aria-label="Forward"><IconChevronRight size={16} stroke={1.6} /></button>
        </div>
        <div className="command-center" aria-label="Command center">
          <IconSearch className="command-center-icon" size={14} stroke={1.6} aria-hidden="true" />
          <span>monaco-git-conflict-demo</span>
          <span className="command-center-hint">⌘ P</span>
        </div>
        <div className="titlebar-actions">
          <span className="titlebar-indicator"><IconCircleFilled size={7} /> 1</span>
          <span className="titlebar-indicator"><IconDots size={12} /></span>
          <button className="update-button" type="button">Update</button>
          <span className="window-icon" aria-hidden="true"><IconLayoutColumns size={13} stroke={1.5} /></span>
          <span className="window-icon" aria-hidden="true"><IconDots size={12} /></span>
        </div>
      </header>

      <div className="workbench">
        <nav className="activity-bar" aria-label="Activity bar">
          <button className="activity-icon active" type="button" aria-label="Explorer"><IconFolderOpen size={23} stroke={1.3} /></button>
          <button className="activity-icon" type="button" aria-label="Search"><IconSearch size={23} stroke={1.3} /></button>
          <button className="activity-icon" type="button" aria-label="Source Control"><IconGitBranch size={23} stroke={1.3} /><span className="activity-badge">2</span></button>
          <button className="activity-icon" type="button" aria-label="Run and Debug"><IconPlayerPlay size={23} stroke={1.3} /></button>
          <button className="activity-icon" type="button" aria-label="Extensions"><IconPackages size={23} stroke={1.3} /></button>
          <div className="activity-spacer" />
          <button className="activity-icon" type="button" aria-label="Accounts"><IconUserCircle size={22} stroke={1.3} /></button>
          <button className="activity-icon" type="button" aria-label="Manage"><IconSettings size={22} stroke={1.3} /></button>
        </nav>

        <aside className="explorer-sidebar" aria-label="Explorer">
          <div className="sidebar-heading"><span>EXPLORER</span><IconDots className="sidebar-more" size={14} /></div>
          <div className="explorer-content">
            <div className="tree-section-title"><IconChevronDown size={12} /> PROJECTS</div>
            <div className="tree-row folder-root"><IconChevronDown className="tree-chevron" size={11} /><IconFolderOpen className="folder-icon" size={15} /><strong>monaco-git-conflict-demo</strong><IconCircleFilled className="tree-dirty" size={7} /></div>
            <div className="tree-row indent-1"><IconChevronDown className="tree-chevron" size={11} /><IconFolderOpen className="folder-icon" size={15} /><span>src</span></div>
            <div className="tree-row indent-2"><IconChevronDown className="tree-chevron" size={11} /><IconFolderOpen className="folder-icon" size={15} /><span>components</span></div>
            <div className="tree-row indent-3"><IconBrandTypescript className="file-icon ts" size={14} /><span>MergeEditorDialog.tsx</span></div>
            <div className="tree-row indent-3"><IconBrandTypescript className="file-icon ts" size={14} /><span>SourceEditor.tsx</span></div>
            <div className="tree-row indent-2"><IconChevronDown className="tree-chevron" size={11} /><IconFolderOpen className="folder-icon" size={15} /><span>domain</span></div>
            <div className="tree-row indent-3"><IconBrandTypescript className="file-icon ts" size={14} /><span>conflictParser.ts</span></div>
            <div className="tree-row indent-3"><IconBrandTypescript className="file-icon ts" size={14} /><span>resolution.ts</span></div>
            <div className="tree-row indent-3 selected"><IconBrandTypescript className="file-icon ts" size={14} /><span>sampleDocument.ts</span></div>
            <div className="tree-row indent-3"><IconBrandTypescript className="file-icon ts" size={14} /><span>types.ts</span></div>
            <div className="tree-row indent-1"><IconBrandTypescript className="file-icon ts" size={14} /><span>App.tsx</span></div>
            <div className="tree-row indent-1"><IconBrandTypescript className="file-icon ts" size={14} /><span>main.tsx</span></div>
            <div className="tree-row indent-1"><IconHash className="file-icon css" size={14} /><span>styles.css</span></div>
            <div className="tree-row indent-1"><IconMarkdown className="file-icon md" size={14} /><span>README-guide.md</span></div>
            <div className="tree-row indent-1"><IconBraces className="file-icon json" size={14} /><span>package.json</span></div>

            <div className="sidebar-divider" />
            <div className="tree-section-title"><IconChevronDown size={12} /> MERGE INPUTS</div>
            <div className="merge-sidebar-status"><IconCircleFilled className="sidebar-status-dot" size={9} />{unresolvedLabel}</div>
            <div className="merge-sidebar-row"><IconCircleFilled className="source-dot base-dot" size={9} />Base <span>merge base</span></div>
            <div className="merge-sidebar-row"><IconCircleFilled className="source-dot current-dot" size={9} />Current <span>HEAD</span></div>
            <div className="merge-sidebar-row"><IconCircleFilled className="source-dot incoming-dot" size={9} />Incoming <span>feature/i18n</span></div>
          </div>
          <div className="sidebar-footer"><span>OUTLINE</span><IconChevronDown size={12} /></div>
        </aside>

        <section className="editor-workbench">
          <div className="editor-tabs">
            <button className={`editor-tab ${activeEditorTab === 'result' ? 'active' : ''}`} type="button" role="tab" aria-selected={activeEditorTab === 'result'} onClick={() => setActiveEditorTab('result')}>
              <IconBrandTypescript className="file-icon ts" size={14} /><span>sampleDocument.ts</span><span className="editor-tab-close" aria-label="Close sampleDocument.ts"><IconX size={12} /></span>
            </button>
            {compareBlock && <div
              className={`editor-tab compare-tab ${activeEditorTab === 'compare' ? 'active' : ''}`}
              role="tab"
              tabIndex={0}
              aria-selected={activeEditorTab === 'compare'}
              onClick={() => setActiveEditorTab('compare')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') setActiveEditorTab('compare');
              }}
            >
              <IconLayoutColumns size={13} /><span>{compareTabLabel}</span><button className="editor-tab-close-button" type="button" aria-label="Close comparison" onClick={(event) => { event.stopPropagation(); closeCompare(); }}><IconX size={12} /></button>
            </div>}
            {mergeEditorOpen && <div
              className={`editor-tab merge-tab ${activeEditorTab === 'merge' ? 'active' : ''}`}
              role="tab"
              tabIndex={0}
              aria-selected={activeEditorTab === 'merge'}
              onClick={() => setActiveEditorTab('merge')}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') setActiveEditorTab('merge');
              }}
            >
              <IconGitMerge size={13} /><span>sampleDocument.ts: Merge Editor</span><button className="editor-tab-close-button" type="button" aria-label="Close merge editor" onClick={(event) => { event.stopPropagation(); closeMergeEditor(); }}><IconX size={12} /></button>
            </div>}
            {activeEditorTab !== 'compare' && activeEditorTab !== 'merge' && mergeInputTabs.map((tab) => (
              <button className={`editor-tab source-tab ${activeEditorTab === tab.key ? 'active' : ''}`} key={tab.key} type="button" role="tab" aria-selected={activeEditorTab === tab.key} onClick={() => setActiveEditorTab(tab.key)}>
                <IconCircleFilled className={`source-dot ${tab.tone}-dot`} size={9} /><span>{tab.label}</span>
              </button>
            ))}
            <div className="editor-tab-spacer" />
            <button className="tab-action" type="button" aria-label="Split editor"><IconLayoutColumns size={13} /></button>
            <button className="tab-action" type="button" aria-label="More editor actions"><IconDots size={13} /></button>
          </div>

          <div className="breadcrumbs"><span>monaco-git-conflict-demo</span><IconChevronRight size={12} /><span>src</span><IconChevronRight size={12} /><span>domain</span><IconChevronRight size={12} /><strong>{activeEditorTab === 'result' ? <><IconBrandTypescript size={13} /> sampleDocument.ts</> : activeEditorTab === 'compare' ? <><IconLayoutColumns size={13} /> {compareTabLabel}</> : activeEditorTab === 'merge' ? <><IconGitMerge size={13} /> sampleDocument.ts: Merge Editor</> : <><IconCircleFilled className={`source-dot ${activeSourceTab?.tone}-dot`} size={9} /> {activeSourceTab?.label}</>}</strong>{activeEditorTab === 'result' && <><IconChevronRight size={12} /><strong>sampleSession</strong></>}</div>

          <div className="editor-main">
            <div className="editor-toolbar">
              <div className="editor-file-meta">
                {activeEditorTab === 'result' ? <IconBrandTypescript className="file-icon ts" size={14} /> : activeEditorTab === 'compare' ? <IconLayoutColumns size={14} /> : activeEditorTab === 'merge' ? <IconGitMerge size={14} /> : <IconCircleFilled className={`source-dot ${activeSourceTab?.tone}-dot`} size={9} />}
                <strong>{activeEditorTab === 'result' ? 'sampleDocument.ts' : activeEditorTab === 'compare' ? 'Current ↔ Incoming' : activeEditorTab === 'merge' ? 'Merge Editor' : activeSourceTab?.label}</strong>
                <span className="editor-state">{activeEditorTab === 'result' ? unresolvedLabel : activeEditorTab === 'compare' ? 'Synchronized scrolling' : activeEditorTab === 'merge' ? 'Synchronized scrolling · Resizable panes' : activeSourceTab?.ref}</span>
              </div>
              {activeEditorTab === 'result' && <div className="editor-actions">
                  <button className="toolbar-button" type="button" onClick={() => editorRef.current?.undo()} disabled={!snapshot.canUndo} title="Cmd/Ctrl + Z"><IconArrowBackUp size={14} /></button>
                  <button className="toolbar-button" type="button" onClick={() => editorRef.current?.redo()} disabled={!snapshot.canRedo} title="Cmd/Ctrl + Shift + Z"><IconArrowForwardUp size={14} /></button>
                  <button className="toolbar-button" type="button" onClick={reset}>Reset</button>
                  <button className="toolbar-button" type="button" onClick={() => setAiAssistantOpen(true)} disabled={snapshot.unresolvedCount === 0}>AI resolve</button>
                  <button className="toolbar-button" type="button" onClick={openMergeEditor} disabled={snapshot.unresolvedCount === 0 || !resultModel}>Merge Editor</button>
                  <button className="toolbar-button complete-button" type="button" disabled={snapshot.unresolvedCount !== 0 || completed} onClick={() => setCompleted(true)}>{completed ? 'Complete' : 'Complete merge'}</button>
                </div>}
            </div>

            <div className="editor-view-stack">
              <div className={`editor-scroll editor-view ${activeEditorTab === 'result' ? '' : 'is-hidden'}`}>
                <section className="result-card vscode-result-card" aria-label="Editable merge result">
                  <ConflictEditor
                    key={sessionRevision}
                    ref={editorRef}
                    initialText={sampleSession.initialResult}
                    initialBlocks={sampleSession.conflicts}
                    onSnapshot={handleSnapshot}
                    onCompare={openCompare}
                    onContentChange={setResultText}
                    onReady={setResultModel}
                  />
                  <footer className="result-footer"><span>Accept Both: <b>Current → Incoming</b></span><span>Manual edits reparse live ranges</span></footer>
                </section>
              </div>
              <div className={`editor-scroll editor-view ${activeEditorTab === 'result' ? 'is-hidden' : ''}`}>
                {activeEditorTab === 'compare' && compareBlock ? <CompareEditorTab currentText={sampleSession.current.text} incomingText={sampleSession.incoming.text} /> : activeEditorTab === 'merge' && mergeEditorOpen && resultModel ? <MergeEditorTab resultText={resultText} resultModel={resultModel} session={sampleSession} onApply={applyWorkspaceChoice} /> : <section className={`source-card vscode-source-card ${activeSourceTab?.tone ?? ''}`} aria-label={`${activeSourceTab?.label} source`}>
                  {activeSourceTab?.key === 'base' && <SourceEditor version={sampleSession.base} tone="base" comparisonTexts={sourceComparisons.base} />}
                  {activeSourceTab?.key === 'current' && <SourceEditor version={sampleSession.current} tone="current" comparisonTexts={sourceComparisons.current} />}
                  {activeSourceTab?.key === 'incoming' && <SourceEditor version={sampleSession.incoming} tone="incoming" comparisonTexts={sourceComparisons.incoming} />}
                </section>}
              </div>
            </div>
          </div>

          <section className="bottom-panel" aria-label="Terminal panel">
            <div className="bottom-panel-tabs"><span className="bottom-tab active">TERMINAL</span><span className="bottom-tab">PROBLEMS <b>0</b></span><span className="bottom-tab">OUTPUT</span><span className="bottom-tab">DEBUG CONSOLE</span><span className="bottom-tab">PORTS</span><span className="bottom-panel-spacer" /><div className="bottom-panel-actions"><button className="bottom-panel-action" type="button" aria-label="New terminal"><IconPlus size={14} /></button><button className="bottom-panel-action" type="button" aria-label="More terminal actions"><IconDots size={14} /></button><button className="bottom-panel-action" type="button" aria-label="Toggle panel"><IconChevronUp size={14} /></button></div></div>
            <div className="terminal-content"><div><span className="terminal-prompt">hongye.guo@monaco-git-conflict-demo</span> <span className="terminal-command">$ npm run dev</span></div><div className="terminal-muted">VITE v7 · Local: http://localhost:5173/</div><div className="terminal-muted">{snapshot.totalConflicts} conflict blocks parsed · {snapshot.historyLength} accept operations recorded</div></div>
          </section>

          <footer className="statusbar"><span className="statusbar-item"><IconGitBranch size={12} stroke={1.7} /> main*</span><span className="statusbar-item"><IconGitMerge size={12} stroke={1.7} /> {snapshot.unresolvedCount} conflicts</span><span className="statusbar-spacer" /><span>Ln 54, Col 1</span><span>Spaces: 2</span><span>UTF-8</span><span>LF</span><span>TypeScript</span><span className="statusbar-item"><IconCheck size={12} stroke={1.8} /></span></footer>
        </section>
      </div>
      {aiAssistantOpen && <AiResolutionDialog onClose={() => setAiAssistantOpen(false)} />}
    </div>
  );
}
