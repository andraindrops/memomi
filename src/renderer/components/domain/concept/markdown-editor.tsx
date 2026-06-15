import { Crepe } from "@milkdown/crepe";
import { useEffect, useRef } from "react";
import { cn } from "@/renderer/lib/utils";
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

    return () => {
      void created.then(() => crepe.destroy());
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "rounded-md border border-input bg-transparent text-sm shadow-xs [&_.milkdown]:outline-none [&_.milkdown]:[--crepe-font-default:var(--font-mono)]! [&_.milkdown]:[--crepe-font-title:var(--font-mono)]! [&_.milkdown_.ProseMirror]:min-h-72 [&_.milkdown_.ProseMirror]:px-4 [&_.milkdown_.ProseMirror]:py-3",
        className,
      )}
    />
  );
}
