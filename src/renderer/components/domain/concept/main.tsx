import { useCallback, useState } from "react";
import { Concept } from "@/renderer/components/domain/concept/concept";
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
}: {
  concept: ConceptSchema;
  updateEntry: (input: UpdateConceptInputSchema) => Promise<void>;
  deleteEntry: (path: string) => Promise<void>;
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

  return (
    <div className="mx-auto max-w-3xl">
      <Concept
        editor={editor}
        onChangeBody={setBody}
        onChangeFrontmatter={setFrontmatter}
        onChangeFrontmatterKey={setFrontmatterKey}
        onUpdate={updateEntry}
        onDelete={() => void deleteEntry(editor.baseline.path)}
      />
    </div>
  );
}
