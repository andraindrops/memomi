import { useCallback, useEffect, useState } from "react";
import { FolderOpen } from "lucide-react";
import { Route, Switch, useLocation } from "wouter";
import { toast } from "sonner";
import { Button } from "@/renderer/components/ui/button";
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
  const [location, navigate] = useLocation();

  useEffect(() => {
    void api.bundle.current().then((current) => {
      if (current != null) setRoot(current.root);
    });
  }, []);

  const openBundle = useCallback(async () => {
    try {
      const info = await api.bundle.read();
      if (info == null) return;
      setRoot(info.root);
      navigate("/");
      toast.success("Bundle opened");
    } catch (error) {
      toast.error(errorMessage({ error, fallback: "Failed to open bundle" }));
    }
  }, [navigate]);

  useEffect(() => api.menu.onOpenBundle(() => void openBundle()), [openBundle]);

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

  const currentConcept = parseCurrentConcept(location);
  const conceptLoader = useCallback(
    () =>
      currentConcept == null
        ? Promise.resolve(null)
        : api.concept.read(currentConcept),
    [currentConcept],
  );

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
    async (input: {
      directory: string;
      fileName?: string;
      title?: string;
      type?: string;
    }) => {
      try {
        const concept = await api.concept.create(input);
        await reload();
        navigate(conceptHref(concept.path));
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
        const current = parseCurrentConcept(location);
        if (current === oldPath) {
          navigate(conceptHref(newPath));
        } else if (current?.startsWith(`${oldPath}/`)) {
          navigate(conceptHref(`${newPath}${current.slice(oldPath.length)}`));
        }
        toast.success("Renamed");
      } catch (error) {
        toast.error(errorMessage({ error, fallback: "Failed to rename" }));
      }
    },
    [reload, location, navigate],
  );

  const deleteEntry = useCallback(
    async (path: string) => {
      try {
        await api.concept.delete(path);
        const current = parseCurrentConcept(location);
        if (current === path || current?.startsWith(`${path}/`)) {
          navigate("/");
        }
        await reload();
        toast.success("Deleted");
      } catch (error) {
        toast.error(errorMessage({ error, fallback: "Failed to delete" }));
      }
    },
    [reload, location, navigate],
  );

  const updateEntry = useCallback(
    async (input: UpdateConceptInputSchema) => {
      try {
        await api.concept.update(input);
        await reload();
        toast.success("Saved");
      } catch (error) {
        toast.error(errorMessage({ error, fallback: "Failed to save" }));
      }
    },
    [reload],
  );

  if (root == null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <FolderOpen className="size-10 text-muted-foreground" />
        <p className="text-muted-foreground">No OKF bundle is open.</p>
        <Button onClick={() => void openBundle()}>Open Bundle</Button>
      </div>
    );
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
        />
      </aside>
      <main className="min-w-0 flex-1 overflow-auto p-6">
        <Switch>
          <Route path="/concept/:path">
            {conceptState.status === "error" ? (
              <p className="text-destructive">{conceptState.message}</p>
            ) : loadedConcept != null ? (
              <Main
                key={loadedConcept.path}
                concept={loadedConcept}
                updateEntry={updateEntry}
                deleteEntry={deleteEntry}
              />
            ) : (
              <LoadingMessage />
            )}
          </Route>
          <Route path="/">
            <p className="text-muted-foreground">
              Select a concept from the sidebar to edit it.
            </p>
          </Route>
          <Route>
            <p className="text-muted-foreground">Page not found.</p>
          </Route>
        </Switch>
      </main>
    </div>
  );
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
