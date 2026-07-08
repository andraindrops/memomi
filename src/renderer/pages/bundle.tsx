import { useCallback, useEffect, useState } from "react";
import { Route, Switch, useLocation } from "wouter";
import { PenTool } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/renderer/lib/api";
import {
  conceptHref,
  parseCurrentConcept,
} from "@/renderer/hooks/use-current-concept";
import { useFetchState } from "@/renderer/hooks/use-fetch-state";
import { LoadingMessage } from "@/renderer/components/shared/loading-message";
import { SidebarTree } from "@/renderer/components/domain/concept/sidebar-tree";
import { Main } from "@/renderer/components/domain/concept/main";
import type { BundleNodeSchema } from "@/shared/schemas/bundle";
import type { UpdateConceptInputSchema } from "@/shared/schemas/concept";

export function BundlePage() {
  const [root, setRoot] = useState<string | null>(null);
  const [tree, setTree] = useState<BundleNodeSchema | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [location, navigate] = useLocation();

  useEffect(() => {
    void api.bundle.current().then((current) => {
      if (current != null) setRoot(current.root);
    });
  }, []);

  const reload = useCallback(async () => {
    setTree(await api.bundle.tree());
  }, []);

  useEffect(() => {
    if (root == null) {
      setTree(null);
      return;
    }
    void reload();
  }, [root, reload]);

  const [refreshKey, setRefreshKey] = useState(0);
  const refreshOpenConcept = useCallback(
    () => setRefreshKey((count) => count + 1),
    [],
  );

  const currentConcept = parseCurrentConcept({ location });
  const conceptLoader = useCallback(() => {
    void refreshKey;
    return currentConcept == null
      ? Promise.resolve(null)
      : api.concept.read({ path: currentConcept });
  }, [currentConcept, refreshKey]);

  const { state: conceptState } = useFetchState({
    loader: conceptLoader,
    errorMessage: "Failed to open concept",
  });

  const loadedConcept =
    conceptState.status === "loaded" &&
    conceptState.value?.path === currentConcept
      ? conceptState.value
      : null;

  const createConcept = useCallback(
    async (input: { directory: string; title?: string; type?: string }) => {
      try {
        const concept = await api.concept.create(input);
        await reload();
        navigate(conceptHref({ path: concept.path }));
        toast.success("Concept created");
      } catch (error) {
        toast.error(
          errorMessage({ error, fallback: "Failed to create concept" }),
        );
      }
    },
    [reload, navigate],
  );

  const createDirectory = useCallback(
    async (parent: string, name?: string) => {
      try {
        await api.conceptDirectory.create({ parent, name });
        await reload();
        toast.success("Folder created");
      } catch (error) {
        toast.error(
          errorMessage({ error, fallback: "Failed to create folder" }),
        );
      }
    },
    [reload],
  );

  const renameEntry = useCallback(
    async (oldPath: string, newName: string) => {
      try {
        const { path: newPath } = await api.concept.rename({
          path: oldPath,
          newName,
        });
        await reload();
        refreshOpenConcept();
        followMovedConcept({
          current: parseCurrentConcept({ location }),
          from: oldPath,
          to: newPath,
          navigate,
        });
        toast.success("Renamed");
      } catch (error) {
        toast.error(errorMessage({ error, fallback: "Failed to rename" }));
      }
    },
    [reload, location, navigate, refreshOpenConcept],
  );

  const deleteEntry = useCallback(
    async (path: string) => {
      try {
        await api.concept.delete({ path });
        const current = parseCurrentConcept({ location });
        if (
          current != null &&
          isSelfOrDescendant({ path: current, ancestor: path })
        ) {
          navigate("/");
        }
        await reload();
        refreshOpenConcept();
        toast.success("Deleted");
      } catch (error) {
        toast.error(errorMessage({ error, fallback: "Failed to delete" }));
      }
    },
    [reload, location, navigate, refreshOpenConcept],
  );

  const reorder = useCallback(
    async (directory: string, orderedNames: string[], movedPath?: string) => {
      try {
        const { path: newPath } = await api.bundle.reorder({
          directory,
          orderedNames,
          movedPath,
        });
        await reload();
        refreshOpenConcept();
        if (newPath != null && movedPath != null) {
          followMovedConcept({
            current: parseCurrentConcept({ location }),
            from: movedPath,
            to: newPath,
            navigate,
          });
          toast.success("Moved");
        }
      } catch (error) {
        toast.error(errorMessage({ error, fallback: "Failed to reorder" }));
      }
    },
    [reload, location, navigate, refreshOpenConcept],
  );

  const updateEntry = useCallback(
    async (input: UpdateConceptInputSchema) => {
      try {
        const updated = await api.concept.update(input);
        await reload();
        if (updated.path !== input.path) {
          const current = parseCurrentConcept(location);
          if (current === input.path) navigate(conceptHref(updated.path));
        }
      } catch (error) {
        toast.error(errorMessage({ error, fallback: "Failed to save" }));
      }
    },
    [reload, location, navigate],
  );

  const renderConcept = () => {
    if (conceptState.status === "error") {
      return <p className="text-destructive">{conceptState.message}</p>;
    }
    if (loadedConcept == null) {
      return <LoadingMessage />;
    }
    return (
      <Main
        key={`${loadedConcept.path}:${loadedConcept.updatedAt ?? ""}`}
        concept={loadedConcept}
        updateEntry={updateEntry}
        deleteEntry={deleteEntry}
        inspectorOpen={inspectorOpen}
        setInspectorOpen={setInspectorOpen}
      />
    );
  };

  if (root == null) {
    return <LoadingMessage />;
  }

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-72 shrink-0 overflow-hidden border-r bg-sidebar p-2">
        <SidebarTree
          tree={tree}
          createConcept={createConcept}
          createDirectory={createDirectory}
          renameEntry={renameEntry}
          deleteEntry={deleteEntry}
          reorder={reorder}
        />
      </aside>
      <main className="min-w-0 flex-1 overflow-auto p-2">
        <Switch>
          <Route path="/concept/:path">{renderConcept()}</Route>
          <Route path="/">
            <div className="flex h-full items-center justify-center">
              <PenTool className="size-16 text-muted-foreground" />
            </div>
          </Route>
          <Route>
            <p className="text-muted-foreground">Page not found.</p>
          </Route>
        </Switch>
      </main>
    </div>
  );
}

function followMovedConcept({
  current,
  from,
  to,
  navigate,
}: {
  current: string | null;
  from: string;
  to: string;
  navigate: (path: string) => void;
}): void {
  if (current === from) {
    navigate(conceptHref({ path: to }));
  } else if (current?.startsWith(`${from}/`)) {
    navigate(conceptHref({ path: `${to}${current.slice(from.length)}` }));
  }
}

function isSelfOrDescendant({
  path,
  ancestor,
}: {
  path: string;
  ancestor: string;
}): boolean {
  return path === ancestor || path.startsWith(`${ancestor}/`);
}

function errorMessage({
  error,
  fallback,
}: {
  error: unknown;
  fallback: string;
}): string {
  return error instanceof Error ? error.message : fallback;
}
