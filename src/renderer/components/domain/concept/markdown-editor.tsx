import { Crepe } from "@milkdown/crepe";
// eslint-disable-next-line import/no-unresolved
import { editorViewCtx } from "@milkdown/kit/core";
import { useEffect, useRef } from "react";
import { cn } from "@/renderer/lib/utils";
import {
  NODE_DRAG_MIME,
  type NodeDragPayload,
} from "@/renderer/components/domain/concept/node-drag";
// eslint-disable-next-line import/no-unresolved
import "@milkdown/crepe/theme/common/style.css";
// eslint-disable-next-line import/no-unresolved
import "@milkdown/crepe/theme/nord.css";

export function MarkdownEditor({
  defaultValue,
  onChange,
  className,
}: {
  defaultValue: string;
  onChange: (markdown: string) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const defaultValueRef = useRef(defaultValue);

  useEffect(() => {
    const root = containerRef.current;
    if (root == null) {
      return;
    }

    const crepe = new Crepe({ root, defaultValue: defaultValueRef.current });
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        onChangeRef.current(markdown);
      });
    });

    const created = crepe.create().catch((error) => {
      console.error("Failed to create Milkdown editor", error);
    });

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
      const label = payload.name.replace(/\.md$/i, "");
      insertLink(crepe, event, label, payload.path);
    };
    root.addEventListener("dragover", handleDragOver, true);
    root.addEventListener("drop", handleDrop, true);

    return () => {
      root.removeEventListener("dragover", handleDragOver, true);
      root.removeEventListener("drop", handleDrop, true);
      void created.then(() => crepe.destroy());
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "rounded-md text-sm [&_.milkdown]:bg-white! [&_.milkdown]:outline-none [&_.milkdown]:[--crepe-font-default:var(--font-mono)]! [&_.milkdown]:[--crepe-font-title:var(--font-mono)]! [&_.milkdown_.ProseMirror]:min-h-72 [&_.milkdown_.ProseMirror]:px-32! [&_.milkdown_.ProseMirror]:py-2! [&_.milkdown_.ProseMirror_:is(h1,h2,h3,h4,h5,h6)]:font-bold! [&_.milkdown_.ProseMirror_h1]:text-2xl! [&_.milkdown_.ProseMirror_h2]:text-xl! [&_.milkdown_.ProseMirror_h3]:text-lg! [&_.milkdown_.ProseMirror_h4]:text-base! [&_.milkdown_.ProseMirror_h5]:text-base! [&_.milkdown_.ProseMirror_h6]:text-base! [&_.milkdown-slash-menu_.tab-group]:hidden! [&_.milkdown-slash-menu_.menu-group_h6]:hidden! [&_.milkdown-slash-menu_.menu-groups]:pt-3!",
        className,
      )}
    />
  );
}

function insertLink(
  crepe: Crepe,
  event: DragEvent,
  label: string,
  href: string,
) {
  crepe.editor.action((ctx) => {
    const view = ctx.get(editorViewCtx);
    const target = view.posAtCoords({
      left: event.clientX,
      top: event.clientY,
    });
    if (target == null) return;
    const { state } = view;
    const linkMark = state.schema.marks.link;
    const text = state.schema.text(
      label,
      linkMark ? [linkMark.create({ href })] : undefined,
    );
    view.dispatch(state.tr.insert(target.pos, text));
    view.focus();
  });
}
