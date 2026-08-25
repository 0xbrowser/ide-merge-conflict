import { useEffect, useRef } from 'react';
import { monaco } from '../monaco';
import type { FileVersion } from '../domain/types';

interface SourceEditorProps {
  readonly version: FileVersion;
  readonly tone: 'base' | 'current' | 'incoming';
  /** Versions compared with this read-only pane to derive every changed range. */
  readonly comparisonTexts: readonly string[];
}

interface ChangedLineRange {
  readonly startLineNumber: number;
  readonly endLineNumber: number;
}

/**
 * Small LCS line diff for the static input panes. Unlike the earlier demo
 * anchor, it reports every changed hunk (including the second conflict).
 */
function changedLines(fromText: string, toText: string, useTargetLines: boolean): ChangedLineRange[] {
  const from = fromText.split('\n');
  const to = toText.split('\n');
  const table = Array.from({ length: from.length + 1 }, () => new Uint16Array(to.length + 1));

  for (let fromIndex = from.length - 1; fromIndex >= 0; fromIndex -= 1) {
    for (let toIndex = to.length - 1; toIndex >= 0; toIndex -= 1) {
      table[fromIndex][toIndex] = from[fromIndex] === to[toIndex]
        ? table[fromIndex + 1][toIndex + 1] + 1
        : Math.max(table[fromIndex + 1][toIndex], table[fromIndex][toIndex + 1]);
    }
  }

  const ranges: ChangedLineRange[] = [];
  let fromIndex = 0;
  let toIndex = 0;
  let changedStart: number | undefined;
  let changedEnd = 0;
  const flush = () => {
    if (changedStart !== undefined && changedEnd >= changedStart) {
      ranges.push({ startLineNumber: changedStart + 1, endLineNumber: changedEnd + 1 });
    }
    changedStart = undefined;
  };
  const record = (lineIndex: number) => {
    changedStart ??= lineIndex;
    changedEnd = lineIndex;
  };

  while (fromIndex < from.length || toIndex < to.length) {
    if (fromIndex < from.length && toIndex < to.length && from[fromIndex] === to[toIndex]) {
      flush();
      fromIndex += 1;
      toIndex += 1;
    } else if (toIndex < to.length && (fromIndex === from.length || table[fromIndex][toIndex + 1] >= table[fromIndex + 1][toIndex])) {
      if (useTargetLines) record(toIndex);
      toIndex += 1;
    } else {
      if (!useTargetLines) record(fromIndex);
      fromIndex += 1;
    }
  }
  flush();
  return ranges;
}

function mergeRanges(ranges: readonly ChangedLineRange[]): ChangedLineRange[] {
  return [...ranges]
    .sort((left, right) => left.startLineNumber - right.startLineNumber)
    .reduce<ChangedLineRange[]>((merged, range) => {
      const previous = merged.at(-1);
      if (previous && range.startLineNumber <= previous.endLineNumber + 1) {
        merged[merged.length - 1] = { ...previous, endLineNumber: Math.max(previous.endLineNumber, range.endLineNumber) };
      } else {
        merged.push(range);
      }
      return merged;
    }, []);
}

export function SourceEditor({ version, tone, comparisonTexts }: SourceEditorProps) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return undefined;
    const model = monaco.editor.createModel(
      version.text,
      'typescript',
      monaco.Uri.parse(`inmemory://merge-input/${version.kind}-${crypto.randomUUID()}.ts`),
    );
    const editor = monaco.editor.create(host.current, {
      model,
      readOnly: true,
      automaticLayout: true,
      minimap: { enabled: false },
      lineNumbersMinChars: 3,
      scrollBeyondLastLine: false,
      fontSize: 12,
      lineHeight: 19,
      padding: { top: 8, bottom: 8 },
      renderLineHighlight: 'none',
    });

    const ranges = mergeRanges(comparisonTexts.flatMap((comparisonText) => (
      tone === 'base'
        ? changedLines(version.text, comparisonText, false)
        : changedLines(comparisonText, version.text, true)
    )));
    if (ranges.length > 0) {
      editor.createDecorationsCollection(ranges.map((range) => ({
        range: new monaco.Range(
          range.startLineNumber,
          1,
          range.endLineNumber,
          model.getLineMaxColumn(range.endLineNumber),
        ),
        options: { isWholeLine: true, className: `source-highlight source-highlight-${tone}` },
      })));
    }

    return () => {
      editor.dispose();
      model.dispose();
    };
  }, [comparisonTexts, tone, version]);

  return <div className="source-editor" ref={host} aria-label={`${version.label} source editor`} />;
}
