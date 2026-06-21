import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Concept } from "@/renderer/components/domain/concept/concept";
import { Inspector } from "@/renderer/components/domain/concept/inspector";
import type {
  ConceptSchema,
  FrontmatterSchema,
  UpdateConceptInputSchema,
} from "@/shared/schemas/concept";

export interface EditorState {
  baseline: ConceptSchema;
  frontmatter: FrontmatterSchema;
  body: string;
}

export function Main({
  concept,
  updateEntry,
  deleteEntry,
  inspectorOpen,
  setInspectorOpen,
}: {
  concept: ConceptSchema;
  updateEntry: (input: UpdateConceptInputSchema) => Promise<void>;
  deleteEntry: (path: string) => Promise<void>;
  inspectorOpen: boolean;
  setInspectorOpen: Dispatch<SetStateAction<boolean>>;
}) {
  const [editor, setEditor] = useState<EditorState>({
    baseline: concept,
    frontmatter: concept.frontmatter,
    body: concept.body,
  });

  const setBody = useCallback((body: string) => {
    setEditor((prev) => ({ ...prev, body }));
  }, []);

  const setFrontmatter = useCallback((frontmatter: FrontmatterSchema) => {
    setEditor((prev) => ({ ...prev, frontmatter }));
  }, []);

  const setFrontmatterKey = useCallback((key: string, value: unknown) => {
    setEditor((prev) => ({
      ...prev,
      frontmatter: { ...prev.frontmatter, [key]: value },
    }));
  }, []);

  // Auto-save edits (debounced) instead of requiring a manual Save action.
  useEffect(() => {
    if (
      editor.body === editor.baseline.body &&
      editor.frontmatter === editor.baseline.frontmatter
    ) {
      return;
    }
    const timer = setTimeout(() => {
      void updateEntry({
        path: editor.baseline.path,
        frontmatter: editor.frontmatter,
        body: editor.body,
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [editor, updateEntry]);

  return (
    <div className="flex min-h-full gap-6">
      <div className="min-w-0 flex-1">
        <Concept
          editor={editor}
          inspectorOpen={inspectorOpen}
          onToggleInspector={() => setInspectorOpen((open) => !open)}
          onChangeBody={setBody}
          onDelete={() => void deleteEntry(editor.baseline.path)}
        />
      </div>
      {inspectorOpen && (
        <Inspector
          editor={editor}
          onChangeFrontmatter={setFrontmatter}
          onChangeFrontmatterKey={setFrontmatterKey}
          onClose={() => setInspectorOpen(false)}
        />
      )}
    </div>
  );
}
