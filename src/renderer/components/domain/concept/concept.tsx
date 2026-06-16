import { Settings, Trash2 } from "lucide-react";
import { Button } from "@/renderer/components/ui/button";
import { MarkdownEditor } from "@/renderer/components/domain/concept/markdown-editor";
import type { EditorState } from "@/renderer/components/domain/concept/main";

export function Concept({
  editor,
  inspectorOpen,
  onToggleInspector,
  onChangeBody,
  onDelete,
}: {
  editor: EditorState;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  onChangeBody: (body: string) => void;
  onDelete: () => void;
}) {
  function handleDelete() {
    if (
      window.confirm(`Delete ${editor.baseline.path}? This cannot be undone.`)
    ) {
      onDelete();
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start justify-end gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant={inspectorOpen ? "secondary" : "ghost"}
            size="icon"
            aria-label="Toggle metadata inspector"
            aria-pressed={inspectorOpen}
            onClick={onToggleInspector}
          >
            <Settings className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete concept"
            onClick={handleDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <MarkdownEditor defaultValue={editor.body} onChange={onChangeBody} />
    </div>
  );
}
