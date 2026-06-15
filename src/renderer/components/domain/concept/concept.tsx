import { Save, Trash2 } from "lucide-react";
import { Button } from "@/renderer/components/ui/button";
import { Input } from "@/renderer/components/ui/input";
import { Label } from "@/renderer/components/ui/label";
import { Textarea } from "@/renderer/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/renderer/components/ui/tabs";
import { Frontmatter } from "@/renderer/components/domain/concept/frontmatter";
import type { EditorState } from "@/renderer/components/domain/concept/main";
import type {
  FrontmatterSchema,
  UpdateConceptInputSchema,
} from "@/shared/schemas/concept";

export function Concept({
  editor,
  onChangeBody,
  onChangeFrontmatter,
  onChangeFrontmatterKey,
  onUpdate,
  onDelete,
}: {
  editor: EditorState;
  onChangeBody: (body: string) => void;
  onChangeFrontmatter: (frontmatter: FrontmatterSchema) => void;
  onChangeFrontmatterKey: (key: string, value: unknown) => void;
  onUpdate: (input: UpdateConceptInputSchema) => void;
  onDelete: () => void;
}) {
  function handleUpdate() {
    onUpdate({
      path: editor.baseline.path,
      frontmatter: editor.frontmatter,
      body: editor.body,
    });
  }

  function handleDelete() {
    if (
      window.confirm(`Delete ${editor.baseline.path}? This cannot be undone.`)
    ) {
      onDelete();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-xs text-muted-foreground">
          {editor.baseline.path}
        </p>
        <div className="flex items-center gap-1">
          <Button size="sm" onClick={handleUpdate}>
            <Save className="size-4" /> Save
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

      <div className="flex flex-col gap-2">
        <Label htmlFor="concept-title">Title</Label>
        <Input
          id="concept-title"
          value={asString({ value: editor.frontmatter.title })}
          onChange={(e) => onChangeFrontmatterKey("title", e.target.value)}
        />
      </div>

      <Tabs defaultValue="content" className="gap-4">
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="concept-body">Body</Label>
            <Textarea
              id="concept-body"
              value={editor.body}
              onChange={(e) => onChangeBody(e.target.value)}
              spellCheck={false}
              className="min-h-80 font-mono text-sm"
            />
          </div>
        </TabsContent>

        <TabsContent value="metadata" className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="concept-description">Description</Label>
            <Textarea
              id="concept-description"
              value={asString({ value: editor.frontmatter.description })}
              onChange={(e) =>
                onChangeFrontmatterKey("description", e.target.value)
              }
              className="min-h-16"
            />
          </div>

          <Frontmatter
            frontmatter={editor.frontmatter}
            onChangeKey={onChangeFrontmatterKey}
            onChange={onChangeFrontmatter}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function asString({ value }: { value: unknown }): string {
  return typeof value === "string" ? value : "";
}
