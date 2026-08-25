# Monaco Git Conflict Demo

A small React + Vite + TypeScript demo that recreates the core interaction patterns of VS Code's Git conflict resolution experience with Monaco Editor.

## Getting started

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

To run the project checks:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

## What this demo simulates

The demo uses in-memory Monaco text models. It does not read a Git repository and does not save, stage, commit, or push files.

- **Merge Conflicts**: a single editable Result file contains standard Git conflict markers. The demo parses the live markers and provides Accept Current, Accept Incoming, Accept Both, Compare Changes, undo, and redo actions.
- **Merge Editor**: a VS Code-like workbench shows Incoming, Current, and Result panes with synchronized scrolling, merge actions, and draggable horizontal and vertical splitters.
- **AI Resolve**: a local loading-style side panel that demonstrates the UI state only. It does not call a remote language model.

The sample starts with two unresolved conflict blocks in `sampleDocument.ts`. Accept operations update the same Monaco model so text changes and the editor undo/redo history stay connected.

## VS Code patterns referenced

This demo references two related VS Code patterns:

1. **Merge Conflicts**, implemented by VS Code's built-in [`extensions/merge-conflict`](https://github.com/microsoft/vscode/tree/main/extensions/merge-conflict) extension. It recognizes `<<<<<<<`, `=======`, and `>>>>>>>` markers in one result file and exposes Current, Incoming, Both, and Compare actions.
2. **Merge Editor**, the VS Code workbench's multi-pane merge experience. It compares Base, Current, Incoming, and Result versions, aligns changes around diff hunks, and lets users review the final Result.

The UI and domain logic here are implemented independently for Monaco. VS Code's merge-conflict extension and Merge Editor are workbench features, not complete drop-in Monaco components.

## Project structure

```text
src/
  domain/       Conflict parsing, resolution rules, mappings, and tests
  components/   Result editor, source editor, compare tab, merge editor, and AI panel
  App.tsx       VS Code-like workbench shell and tab orchestration
  monaco.ts     Monaco theme and worker setup
```
