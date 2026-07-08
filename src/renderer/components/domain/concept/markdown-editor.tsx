// eslint-disable-next-line import/no-unresolved
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import { useEffect, useRef } from "react";
import { cn } from "@/renderer/lib/utils";
import {
  NODE_DRAG_MIME,
  type NodeDragPayload,
} from "@/renderer/components/domain/concept/node-drag";
import {
  EDITOR_THEME,
  headingDecorations,
  INTERNAL_PREFIX,
  pageLinkAt,
  pageLinkDecorations,
  setLinkHandler,
  setupMonaco,
} from "@/renderer/components/domain/concept/monaco-setup";

// Keep in sync with the `p-8` (2rem) class on the container.
const PADDING = 32;

export function MarkdownEditor({
  defaultValue,
  onChange,
  onOpenPath,
  className,
}: {
  defaultValue: string;
  onChange: (markdown: string) => void;
  onOpenPath: (path: string) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onOpenPathRef = useRef(onOpenPath);
  onOpenPathRef.current = onOpenPath;
  const defaultValueRef = useRef(defaultValue);

  useEffect(() => {
    setLinkHandler(onOpenPath);
  }, [onOpenPath]);

  useEffect(() => {
    const root = containerRef.current;
    if (root == null) {
      return;
    }
    setupMonaco();

    const editor = monaco.editor.create(root, {
      value: defaultValueRef.current,
      language: "markdown",
      theme: EDITOR_THEME,
      fontFamily: monoFontFamily(),
      fontSize: 14,
      wordWrap: "on",
      lineNumbers: "off",
      minimap: { enabled: false },
      folding: false,
      glyphMargin: false,
      lineDecorationsWidth: 0,
      lineNumbersMinChars: 0,
      overviewRulerLanes: 0,
      scrollBeyondLastLine: false,
      renderLineHighlight: "none",
      scrollbar: { alwaysConsumeMouseWheel: false },
    });

    const layout = () => {
      editor.layout({
        width: root.clientWidth - PADDING * 2,
        height: root.clientHeight - PADDING * 2,
      });
    };
    layout();

    const headings = editor.createDecorationsCollection();
    const links = editor.createDecorationsCollection();
    const updateDecorations = () => {
      const model = editor.getModel();
      if (model == null) return;
      headings.set(headingDecorations(model));
      links.set(pageLinkDecorations(model));
    };
    updateDecorations();

    const onContent = editor.onDidChangeModelContent(() => {
      onChangeRef.current(editor.getValue());
      updateDecorations();
    });
    // A plain click on a page-link label navigates instead of moving the caret;
    // the surrounding `[`...`](@/path)` syntax stays editable.
    const onMouseDown = editor.onMouseDown((event) => {
      const position = event.target.position;
      const model = editor.getModel();
      if (position == null || model == null) return;
      const dest = pageLinkAt(model, position);
      if (dest == null) return;
      event.event.preventDefault();
      event.event.stopPropagation();
      onOpenPathRef.current(dest);
    });
    const resize = new ResizeObserver(layout);
    resize.observe(root);

    const handleDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes(NODE_DRAG_MIME)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "copy";
    };
    const handleDrop = (event: DragEvent) => {
      const raw = event.dataTransfer?.getData(NODE_DRAG_MIME);
      if (raw == null || raw === "") return;
      event.preventDefault();
      event.stopPropagation();
      let payload: NodeDragPayload;
      try {
        payload = JSON.parse(raw);
      } catch {
        return;
      }
      if (payload.path == null || payload.name == null) return;
      // Concepts are stored as [uuid].md, so the human-readable link label is
      // the frontmatter title; fall back to the file name for old payloads.
      const label = (payload.title ?? payload.name).replace(/\.md$/i, "");
      insertPageLink({ editor, event, label, path: payload.path });
    };
    root.addEventListener("dragover", handleDragOver, true);
    root.addEventListener("drop", handleDrop, true);

    return () => {
      root.removeEventListener("dragover", handleDragOver, true);
      root.removeEventListener("drop", handleDrop, true);
      resize.disconnect();
      onContent.dispose();
      onMouseDown.dispose();
      editor.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "overflow-hidden rounded-md bg-white p-8 text-sm",
        className,
      )}
    />
  );
}

function insertPageLink({
  editor,
  event,
  label,
  path,
}: {
  editor: monaco.editor.IStandaloneCodeEditor;
  event: DragEvent;
  label: string;
  path: string;
}) {
  const target = editor.getTargetAtClientPoint(event.clientX, event.clientY);
  const position = target?.position ?? editor.getPosition();
  if (position == null) return;
  const text = `[${label}](${INTERNAL_PREFIX}${path})`;
  editor.executeEdits("page-link", [
    {
      range: new monaco.Range(
        position.lineNumber,
        position.column,
        position.lineNumber,
        position.column,
      ),
      text,
      forceMoveMarkers: true,
    },
  ]);
  editor.focus();
}

function monoFontFamily(): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-mono")
    .trim();
  return value !== ""
    ? value
    : "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
}
