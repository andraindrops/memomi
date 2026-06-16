import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/renderer/components/ui/button";
import { Input } from "@/renderer/components/ui/input";
import { Label } from "@/renderer/components/ui/label";
import { PromptDialog } from "@/renderer/components/ui/prompt-dialog";
import type { FrontmatterSchema } from "@/shared/schemas/concept";

const EXCLUDED = new Set(["title", "description"]);

export function Frontmatter({
  frontmatter,
  onChangeKey,
  onChange,
}: {
  frontmatter: FrontmatterSchema;
  onChangeKey: (key: string, value: unknown) => void;
  onChange: (frontmatter: FrontmatterSchema) => void;
}) {
  const [adding, setAdding] = useState(false);
  const keys = Object.keys(frontmatter).filter((k) => !EXCLUDED.has(k));

  function removeKey(key: string) {
    const next = { ...frontmatter };
    delete next[key];
    onChange(next);
  }

  function addKey(key: string) {
    setAdding(false);
    if (EXCLUDED.has(key) || key in frontmatter) return;
    onChangeKey(key, "");
  }

  return (
    <div className="flex flex-col gap-2 rounded-md">
      <PromptDialog
        open={adding}
        title="Add frontmatter key"
        label="Key name"
        placeholder="owner"
        confirmLabel="Add"
        onConfirm={addKey}
        onCancel={() => setAdding(false)}
      />
      <div className="flex items-center justify-between">
        <h3 className="text-xs">Frontmatter</h3>
        <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Add key
        </Button>
      </div>
      {keys.length === 0 && (
        <p className="text-xs text-muted-foreground">No metadata keys.</p>
      )}
      {keys.map((key) => (
        <div key={key} className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-2">
            <Label className="text-xs text-muted-foreground">{key}</Label>
            <ValueEditor
              value={frontmatter[key]}
              onChange={(v) => onChangeKey(key, v)}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Remove ${key}`}
            onClick={() => removeKey(key)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function ValueEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (typeof value === "boolean") {
    return (
      <label className="flex h-8 items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4"
        />
        {value ? "true" : "false"}
      </label>
    );
  }

  if (Array.isArray(value)) {
    return (
      <Input
        value={value.join(", ")}
        placeholder="comma, separated, values"
        onChange={(e) =>
          onChange(
            e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s.length > 0),
          )
        }
      />
    );
  }

  if (value != null && typeof value === "object") {
    return (
      <Input
        readOnly
        value={JSON.stringify(value)}
        className="text-muted-foreground"
      />
    );
  }

  return (
    <Input
      value={value == null ? "" : String(value)}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
