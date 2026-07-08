// eslint-disable-next-line import/no-unresolved
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
// eslint-disable-next-line import/no-unresolved
import "monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution";
// eslint-disable-next-line import/no-unresolved
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

export const INTERNAL_PREFIX = "@";
export const EDITOR_THEME = "okf-light";

const LINK_SCHEME = "okf-page";
const PAGE_LINK = /\[((?:[^\]\\]|\\.)*)\]\(@(\/[^)\s#]*)(?:[^)]*)\)/g;

let configured = false;
let linkHandler: ((path: string) => void) | null = null;

export function setupMonaco(): void {
  if (configured) return;
  configured = true;

  self.MonacoEnvironment = {
    getWorker: () => new EditorWorker(),
  };

  defineTheme();
  monaco.languages.registerLinkProvider("markdown", { provideLinks });
  monaco.languages.registerFoldingRangeProvider("markdown", {
    provideFoldingRanges,
  });
  monaco.editor.registerLinkOpener({
    open(resource) {
      if (resource.scheme !== LINK_SCHEME) return false;
      linkHandler?.(resource.path);
      return true;
    },
  });
}

export function setLinkHandler(handler: (path: string) => void): void {
  linkHandler = handler;
}

// Monaco's markdown tokenizer tags every heading as a single `keyword` token, so
// per-level colors can't come from the theme. Decorate heading lines instead and
// fade the black foreground 10% per level via CSS (see `.okf-heading-*`).
export function headingDecorations(
  model: monaco.editor.ITextModel,
): monaco.editor.IModelDeltaDecoration[] {
  const decorations: monaco.editor.IModelDeltaDecoration[] = [];
  const lineCount = model.getLineCount();
  let fenceChar = "";

  for (let line = 1; line <= lineCount; line++) {
    const text = model.getLineContent(line);
    const fence = /^\s*(`{3,}|~{3,})/.exec(text);
    if (fence != null) {
      if (fenceChar === "") fenceChar = fence[1][0];
      else if (text.trimStart().startsWith(fenceChar)) fenceChar = "";
      continue;
    }
    if (fenceChar !== "") continue;
    const heading = /^(#{1,6})\s/.exec(text);
    if (heading == null) continue;
    decorations.push({
      range: new monaco.Range(line, 1, line, text.length + 1),
      options: { inlineClassName: `okf-heading-${heading[1].length}` },
    });
  }

  return decorations;
}

// Style the label of every `[label](@/path)` page link so it reads as a link.
export function pageLinkDecorations(
  model: monaco.editor.ITextModel,
): monaco.editor.IModelDeltaDecoration[] {
  return pageLinkRanges(model).map(({ range }) => ({
    range,
    options: { inlineClassName: "okf-page-link" },
  }));
}

// The destination path of the page link covering `position`, or null when the
// caret is not inside a link label. Drives plain-click navigation.
export function pageLinkAt(
  model: monaco.editor.ITextModel,
  position: monaco.IPosition,
): string | null {
  for (const { range, dest } of pageLinkRanges(model)) {
    if (range.containsPosition(position)) return dest;
  }
  return null;
}

function defineTheme(): void {
  monaco.editor.defineTheme(EDITOR_THEME, {
    base: "vs",
    inherit: false,
    rules: [{ token: "", foreground: "000000" }],
    colors: {
      "editor.foreground": "#000000",
      "editor.background": "#ffffff",
    },
  });
}

function provideFoldingRanges(
  model: monaco.editor.ITextModel,
): monaco.languages.ProviderResult<monaco.languages.FoldingRange[]> {
  const ranges: monaco.languages.FoldingRange[] = [];
  const headings: { line: number; level: number }[] = [];
  const lineCount = model.getLineCount();
  let fenceStart = 0;
  let fenceChar = "";

  for (let line = 1; line <= lineCount; line++) {
    const text = model.getLineContent(line);
    const fence = /^\s*(`{3,}|~{3,})/.exec(text);
    if (fence != null) {
      if (fenceChar === "") {
        fenceStart = line;
        fenceChar = fence[1][0];
      } else if (text.trimStart().startsWith(fenceChar)) {
        if (line > fenceStart) ranges.push({ start: fenceStart, end: line });
        fenceChar = "";
      }
      continue;
    }
    if (fenceChar !== "") continue;
    const heading = /^(#{1,6})\s/.exec(text);
    if (heading != null) headings.push({ line, level: heading[1].length });
  }

  for (let i = 0; i < headings.length; i++) {
    const { line, level } = headings[i];
    let end = lineCount;
    for (let j = i + 1; j < headings.length; j++) {
      if (headings[j].level <= level) {
        end = headings[j].line - 1;
        break;
      }
    }
    while (end > line && model.getLineContent(end).trim() === "") end--;
    if (end > line) ranges.push({ start: line, end });
  }

  return ranges;
}

function provideLinks(
  model: monaco.editor.ITextModel,
): monaco.languages.ProviderResult<monaco.languages.ILinksList> {
  const links = pageLinkRanges(model).map(({ range, dest }) => ({
    range,
    url: monaco.Uri.from({ scheme: LINK_SCHEME, path: dest }),
    tooltip: `Open ${dest}`,
  }));
  return { links };
}

// The label span of each `[label](@/path)` link, paired with its destination.
// Single source for the link provider, decorations, and click navigation.
function pageLinkRanges(
  model: monaco.editor.ITextModel,
): { range: monaco.Range; dest: string }[] {
  const text = model.getValue();
  const ranges: { range: monaco.Range; dest: string }[] = [];
  for (const match of text.matchAll(PAGE_LINK)) {
    if (match.index == null) continue;
    const label = match[1];
    const dest = match[2];
    const labelStart = match.index + 1;
    const start = model.getPositionAt(labelStart);
    const end = model.getPositionAt(labelStart + label.length);
    ranges.push({
      range: new monaco.Range(
        start.lineNumber,
        start.column,
        end.lineNumber,
        end.column,
      ),
      dest,
    });
  }
  return ranges;
}
