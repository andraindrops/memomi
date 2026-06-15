import { useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  FilePlus,
  FileText,
  Folder,
  FolderPlus,
  BookOpen,
  Pencil,
  ScrollText,
  Trash2,
} from "lucide-react";
import { useLocation } from "wouter";
import { PromptDialog } from "@/renderer/components/ui/prompt-dialog";
import { cn } from "@/renderer/lib/utils";
import {
  conceptHref,
  useCurrentConcept,
} from "@/renderer/hooks/use-current-concept";
import type { BundleNodeSchema } from "@/shared/schemas/bundle";

export function SidebarTree({
  tree,
  createConcept,
  createDirectory,
  renameEntry,
  deleteEntry,
}: {
  tree: BundleNodeSchema | null;
  createConcept: (input: {
    directory: string;
    fileName?: string;
    title?: string;
    type?: string;
  }) => Promise<void>;
  createDirectory: (parent: string, name?: string) => Promise<void>;
  renameEntry: (oldPath: string, newName: string) => Promise<void>;
  deleteEntry: (path: string) => Promise<void>;
}) {
  const selectedPath = useCurrentConcept();
  const [, navigate] = useLocation();
  const selectConcept = (path: string) => navigate(conceptHref(path));
  const [renameTarget, setRenameTarget] = useState<BundleNodeSchema | null>(
    null,
  );

  const handleDelete = (node: BundleNodeSchema) => {
    const message =
      node.kind === "directory"
        ? `Delete folder "${node.name}" and everything inside it? This cannot be undone.`
        : `Delete "${node.name}"? This cannot be undone.`;
    if (window.confirm(message)) void deleteEntry(node.path);
  };

  const renameDefault =
    renameTarget == null
      ? ""
      : renameTarget.kind === "directory"
        ? renameTarget.name
        : renameTarget.name.replace(/\.md$/i, "");

  return (
    <div className="flex h-full flex-col gap-2">
      <PromptDialog
        open={renameTarget != null}
        title={`Rename ${renameTarget?.name ?? ""}`}
        label="New name"
        defaultValue={renameDefault}
        confirmLabel="Rename"
        onConfirm={(newName) => {
          const target = renameTarget;
          setRenameTarget(null);
          if (target) void renameEntry(target.path, newName);
        }}
        onCancel={() => setRenameTarget(null)}
      />

      <div className="min-h-0 flex-1 overflow-auto">
        {tree?.children?.map((child) => (
          <TreeItem
            key={child.path}
            node={child}
            depth={0}
            selectedPath={selectedPath}
            onSelect={(p) => void selectConcept(p)}
            onRename={(node) => setRenameTarget(node)}
            onDelete={handleDelete}
            onCreateConcept={(directory) => void createConcept({ directory })}
            onCreateDirectory={(parent) => void createDirectory(parent)}
          />
        ))}
        {tree != null && (
          <div className="flex items-center justify-end gap-2 px-2 pt-2 pb-1">
            <button
              type="button"
              title="New concept"
              className="shrink-0 rounded p-1 hover:bg-accent"
              onClick={() => void createConcept({ directory: "/" })}
            >
              <FilePlus className="size-4 text-muted-foreground" />
            </button>
            <button
              type="button"
              title="New folder"
              className="shrink-0 rounded p-1 hover:bg-accent"
              onClick={() => void createDirectory("/")}
            >
              <FolderPlus className="size-4 text-muted-foreground" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TreeItem({
  node,
  depth,
  selectedPath,
  onSelect,
  onRename,
  onDelete,
  onCreateConcept,
  onCreateDirectory,
}: {
  node: BundleNodeSchema;
  depth: number;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onRename: (node: BundleNodeSchema) => void;
  onDelete: (node: BundleNodeSchema) => void;
  onCreateConcept: (directory: string) => void;
  onCreateDirectory: (parent: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);

  if (node.kind === "directory") {
    return (
      <div>
        <div
          className="group flex items-center rounded-md hover:bg-accent"
          style={{ paddingLeft: depth * 12 + 4 }}
        >
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-1 px-2 py-1 text-sm"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <ChevronDown className="size-4 shrink-0" />
            ) : (
              <ChevronRight className="size-4 shrink-0" />
            )}
            <NodeIcon kind="directory" />
            <span className="truncate">{node.name}</span>
          </button>
          <RowAction
            title="New concept in folder"
            onClick={() => {
              setExpanded(true);
              onCreateConcept(node.path);
            }}
          >
            <FilePlus className="size-4 text-muted-foreground" />
          </RowAction>
          <RowAction
            title="New folder inside"
            onClick={() => {
              setExpanded(true);
              onCreateDirectory(node.path);
            }}
          >
            <FolderPlus className="size-4 text-muted-foreground" />
          </RowAction>
          <RowAction title="Rename" onClick={() => onRename(node)}>
            <Pencil className="size-4 text-muted-foreground" />
          </RowAction>
          <RowAction title="Delete" onClick={() => onDelete(node)}>
            <Trash2 className="size-4 text-muted-foreground" />
          </RowAction>
        </div>
        {expanded &&
          node.children?.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              onCreateConcept={onCreateConcept}
              onCreateDirectory={onCreateDirectory}
            />
          ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-center rounded-md hover:bg-accent",
        selectedPath === node.path && "bg-accent font-medium",
      )}
      style={{ paddingLeft: depth * 12 + 20 }}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1 text-sm"
        onClick={() => onSelect(node.path)}
      >
        <NodeIcon kind={node.kind} />
        <span className="truncate">{node.name}</span>
      </button>
      <RowAction title="Rename" onClick={() => onRename(node)}>
        <Pencil className="size-4 text-muted-foreground" />
      </RowAction>
      <RowAction title="Delete" onClick={() => onDelete(node)}>
        <Trash2 className="size-4 text-muted-foreground" />
      </RowAction>
    </div>
  );
}

function NodeIcon({ kind }: { kind: BundleNodeSchema["kind"] }) {
  switch (kind) {
    case "directory":
      return <Folder className="size-4 text-muted-foreground" />;
    case "index":
      return <BookOpen className="size-4 text-muted-foreground" />;
    case "log":
      return <ScrollText className="size-4 text-muted-foreground" />;
    default:
      return <FileText className="size-4 text-muted-foreground" />;
  }
}

function RowAction({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      className="shrink-0 rounded p-1 opacity-0 hover:bg-background group-hover:opacity-100"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}
