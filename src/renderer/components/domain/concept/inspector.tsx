import { X } from "lucide-react";
import { Button } from "@/renderer/components/ui/button";
import { Frontmatter } from "@/renderer/components/domain/concept/frontmatter";
import type { EditorState } from "@/renderer/components/domain/concept/main";
import type { FrontmatterSchema } from "@/shared/schemas/concept";

export function Inspector({
  editor,
  onChangeFrontmatter,
  onChangeFrontmatterKey,
  onClose,
}: {
  editor: EditorState;
  onChangeFrontmatter: (frontmatter: FrontmatterSchema) => void;
  onChangeFrontmatterKey: (key: string, value: unknown) => void;
  onClose: () => void;
}) {
  return (
    <aside className="sticky top-0 flex max-h-[calc(100vh-3rem)] w-72 shrink-0 flex-col gap-4 self-start overflow-y-auto rounded-lg p-4 text-xs">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold">Metadata</h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close inspector"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>

      <Frontmatter
        frontmatter={editor.frontmatter}
        onChangeKey={onChangeFrontmatterKey}
        onChange={onChangeFrontmatter}
      />
    </aside>
  );
}
