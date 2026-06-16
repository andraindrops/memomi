import { useState, type DragEvent, type ReactNode } from "react";
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
  NODE_DRAG_MIME,
  clearActiveNodeDrag,
  getActiveNodeDrag,
  setActiveNodeDrag,
  type NodeDragPayload,
} from "@/renderer/components/domain/concept/node-drag";
import {
  conceptHref,
  useCurrentConcept,
} from "@/renderer/hooks/use-current-concept";
import type { BundleNodeSchema } from "@/shared/schemas/bundle";

// "before"/"after" position relative to a row; "inside" drops into a directory.
type DropPosition = "before" | "after" | "inside";

export function SidebarTree({
  tree,
  createConcept,
  createDirectory,
  renameEntry,
  deleteEntry,
  reorder,
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
  // Apply `orderedNames` to `directory`; `movedPath` (when from another folder)
  // is moved in first.
  reorder: (
    directory: string,
    orderedNames: string[],
    movedPath?: string,
  ) => Promise<void>;
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
    <div className="flex h-full flex-col gap-2 text-xs">
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
        {tree != null && (
          <TreeChildren
            siblings={tree.children ?? []}
            parentPath={tree.path}
            depth={0}
            selectedPath={selectedPath}
            onSelect={(p) => void selectConcept(p)}
            onRename={(node) => setRenameTarget(node)}
            onDelete={handleDelete}
            onCreateConcept={(directory) => void createConcept({ directory })}
            onCreateDirectory={(parent) => void createDirectory(parent)}
            onReorder={(directory, names, movedPath) =>
              void reorder(directory, names, movedPath)
            }
          />
        )}
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

interface TreeHandlers {
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onRename: (node: BundleNodeSchema) => void;
  onDelete: (node: BundleNodeSchema) => void;
  onCreateConcept: (directory: string) => void;
  onCreateDirectory: (parent: string) => void;
  // Apply the new order to `directory`; `movedPath` is moved in when it comes
  // from another directory (drag across folders).
  onReorder: (
    directory: string,
    orderedNames: string[],
    movedPath: string,
  ) => void;
}

// Renders one directory level. Owns the drop-indicator state and turns a
// before/after drop onto a sibling into a reordered name list — either an
// in-place reorder (same parent) or a move from another directory.
function TreeChildren({
  siblings,
  parentPath,
  depth,
  ...handlers
}: {
  siblings: BundleNodeSchema[];
  parentPath: string;
  depth: number;
} & TreeHandlers) {
  const [dropTarget, setDropTarget] = useState<{
    name: string;
    position: DropPosition;
  } | null>(null);

  const handleDrop = (
    targetName: string,
    dragged: NodeDragPayload,
    position: DropPosition,
  ) => {
    setDropTarget(null);
    const original = siblings.map((c) => c.name);
    const next = original.filter((n) => n !== dragged.name);
    const targetIndex = next.indexOf(targetName);
    if (targetIndex === -1) return;
    next.splice(
      position === "before" ? targetIndex : targetIndex + 1,
      0,
      dragged.name,
    );
    // Same-parent drop that changes nothing is a no-op.
    if (
      dragged.parentPath === parentPath &&
      next.join("\n") === original.join("\n")
    ) {
      return;
    }
    handlers.onReorder(parentPath, next, dragged.path);
  };

  return (
    <div className="space-y-2">
      {siblings.map((child) => (
        <TreeItem
          key={child.path}
          node={child}
          parentPath={parentPath}
          depth={depth}
          dropIndicator={
            dropTarget?.name === child.name ? dropTarget.position : null
          }
          onReorderHover={(position) =>
            setDropTarget({ name: child.name, position })
          }
          onReorderLeave={() =>
            setDropTarget((t) => (t?.name === child.name ? null : t))
          }
          onReorderDrop={(dragged, position) =>
            handleDrop(child.name, dragged, position)
          }
          onReorderEnd={() => setDropTarget(null)}
          {...handlers}
        />
      ))}
    </div>
  );
}

function TreeItem({
  node,
  parentPath,
  depth,
  dropIndicator,
  onReorderHover,
  onReorderLeave,
  onReorderDrop,
  onReorderEnd,
  ...handlers
}: {
  node: BundleNodeSchema;
  parentPath: string;
  depth: number;
  dropIndicator: DropPosition | null;
  onReorderHover: (position: DropPosition) => void;
  onReorderLeave: () => void;
  onReorderDrop: (dragged: NodeDragPayload, position: DropPosition) => void;
  onReorderEnd: () => void;
} & TreeHandlers) {
  const [expanded, setExpanded] = useState(depth < 1);

  // Resolve the drop intent for the current cursor position, or null if the
  // drag cannot land here (onto itself, or a folder into its own subtree).
  const resolveDrop = (
    event: DragEvent<HTMLDivElement>,
  ): DropPosition | null => {
    const drag = getActiveNodeDrag();
    if (drag == null || drag.path === node.path) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientY - rect.top) / rect.height;

    if (node.kind === "directory") {
      const position =
        ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "inside";
      if (position === "inside") {
        return isInsideOrSelf(node.path, drag.path) ? null : "inside";
      }
      return isInsideOrSelf(parentPath, drag.path) ? null : position;
    }

    if (isInsideOrSelf(parentPath, drag.path)) return null;
    return ratio < 0.5 ? "before" : "after";
  };

  const dropInto = (drag: NodeDragPayload) => {
    const childNames = (node.children ?? [])
      .map((c) => c.name)
      .filter((n) => n !== drag.name);
    childNames.push(drag.name);
    handlers.onReorder(node.path, childNames, drag.path);
  };

  const dropProps = {
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      const position = resolveDrop(event);
      if (position == null) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      onReorderHover(position);
    },
    onDragLeave: () => onReorderLeave(),
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      const position = resolveDrop(event);
      const drag = getActiveNodeDrag();
      if (position == null || drag == null) return;
      event.preventDefault();
      event.stopPropagation();
      if (position === "inside") {
        onReorderEnd();
        dropInto(drag);
      } else {
        onReorderDrop(drag, position);
      }
    },
  };

  const dragProps = nodeDragProps({
    node,
    parentPath,
    onDragEnd: onReorderEnd,
  });

  if (node.kind === "directory") {
    return (
      <div className="space-y-2">
        <div
          className={cn(
            "group relative flex items-center rounded-md hover:bg-accent",
            dropIndicator === "inside" && "ring-2 ring-inset ring-primary",
          )}
          style={{ paddingLeft: depth * 12 + 4 }}
          {...dropProps}
        >
          {(dropIndicator === "before" || dropIndicator === "after") && (
            <DropLine position={dropIndicator} />
          )}
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1 text-xs"
            onClick={() => setExpanded((v) => !v)}
            {...dragProps}
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
              handlers.onCreateConcept(node.path);
            }}
          >
            <FilePlus className="size-4 text-muted-foreground" />
          </RowAction>
          <RowAction
            title="New folder inside"
            onClick={() => {
              setExpanded(true);
              handlers.onCreateDirectory(node.path);
            }}
          >
            <FolderPlus className="size-4 text-muted-foreground" />
          </RowAction>
          <RowAction title="Rename" onClick={() => handlers.onRename(node)}>
            <Pencil className="size-4 text-muted-foreground" />
          </RowAction>
          <RowAction title="Delete" onClick={() => handlers.onDelete(node)}>
            <Trash2 className="size-4 text-muted-foreground" />
          </RowAction>
        </div>
        {expanded && (
          <TreeChildren
            siblings={node.children ?? []}
            parentPath={node.path}
            depth={depth + 1}
            {...handlers}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative flex items-center rounded-md hover:bg-accent",
        handlers.selectedPath === node.path && "bg-accent font-medium",
      )}
      style={{ paddingLeft: depth * 12 + 20 }}
      {...dropProps}
    >
      {(dropIndicator === "before" || dropIndicator === "after") && (
        <DropLine position={dropIndicator} />
      )}
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1 text-xs"
        onClick={() => handlers.onSelect(node.path)}
        {...dragProps}
      >
        <NodeIcon kind={node.kind} />
        <span className="truncate">{node.name}</span>
      </button>
      <RowAction title="Rename" onClick={() => handlers.onRename(node)}>
        <Pencil className="size-4 text-muted-foreground" />
      </RowAction>
      <RowAction title="Delete" onClick={() => handlers.onDelete(node)}>
        <Trash2 className="size-4 text-muted-foreground" />
      </RowAction>
    </div>
  );
}

// True when `path` is `ancestor` itself or nested under it.
function isInsideOrSelf(path: string, ancestor: string): boolean {
  return path === ancestor || path.startsWith(`${ancestor}/`);
}

function nodeDragProps({
  node,
  parentPath,
  onDragEnd,
}: {
  node: BundleNodeSchema;
  parentPath: string;
  onDragEnd: () => void;
}) {
  return {
    draggable: true,
    onDragStart: (event: DragEvent) => {
      const payload: NodeDragPayload = {
        path: node.path,
        name: node.name,
        parentPath,
      };
      event.dataTransfer.setData(NODE_DRAG_MIME, JSON.stringify(payload));
      event.dataTransfer.effectAllowed = "copyMove";
      setActiveNodeDrag(payload);
    },
    onDragEnd: () => {
      clearActiveNodeDrag();
      onDragEnd();
    },
  };
}

function DropLine({ position }: { position: "before" | "after" }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-1 z-10 h-0.5 bg-primary",
        position === "before" ? "top-0" : "bottom-0",
      )}
    />
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
