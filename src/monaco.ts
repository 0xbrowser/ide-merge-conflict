import * as monaco from '../node_modules/monaco-editor/esm/vs/editor/editor.api.js';
import '../node_modules/monaco-editor/esm/vs/language/typescript/monaco.contribution.js';
// Vite needs concrete worker entrypoints. The public `monaco-editor` export
// aliases are used for the API import below; these are the package's worker files.
import EditorWorker from '../node_modules/monaco-editor/esm/vs/editor/editor.worker.js?worker';
import TypeScriptWorker from '../node_modules/monaco-editor/esm/vs/language/typescript/ts.worker.js?worker';

type MonacoGlobal = typeof globalThis & {
  MonacoEnvironment?: { getWorker(_: string, label: string): Worker };
};

(globalThis as MonacoGlobal).MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'typescript' || label === 'javascript') return new TypeScriptWorker();
    return new EditorWorker();
  },
};

monaco.editor.defineTheme('conflict-resolver-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    // VS Code Dark Modern: neutral surfaces, #0078D4 focus/primary blue.
    'editor.background': '#1F1F1F',
    'editor.foreground': '#CCCCCC',
    'editorGutter.background': '#1F1F1F',
    'editorLineNumber.foreground': '#6E7681',
    'editorLineNumber.activeForeground': '#CCCCCC',
    'editor.lineHighlightBackground': '#2A2D2E',
    'editorIndentGuide.background1': '#404040',
    'focusBorder': '#0078D4',
    'editorWidget.background': '#202020',
    'editorWidget.border': '#303031',
    'scrollbar.shadow': '#00000000',
    'scrollbarSlider.background': '#4C4C4C99',
    'scrollbarSlider.hoverBackground': '#666666B8',
    'scrollbarSlider.activeBackground': '#7A7A7ACC',
  },
});

monaco.editor.setTheme('conflict-resolver-dark');

export { monaco };
