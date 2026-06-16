import type {
  BundleSchema,
  BundleNodeSchema,
  ReorderInputSchema,
} from "@/shared/schemas/bundle";
import type {
  ConceptSchema,
  ConceptSummarySchema,
  CreateConceptInputSchema,
  CreateConceptDirectoryInputSchema,
  RenameConceptInputSchema,
} from "@/shared/schemas/concept";

// prettier-ignore
export const IPC = {
  bundleRead:             "bundle:read",
  bundleCurrent:          "bundle:current",
  bundleTree:             "bundle:tree",
  bundleReorder:          "bundle:reorder",
  conceptList:            "concept:list",
  conceptRead:            "concept:read",
  conceptCreate:          "concept:create",
  conceptUpdate:          "concept:update",
  conceptDelete:          "concept:delete",
  conceptRename:          "concept:rename",
  conceptDirectoryCreate: "conceptDirectory:create",
  menuOpenBundle:         "menu:open-bundle",
  menuSignOut:            "menu:sign-out",
} as const;

export interface AppApi {
  bundle: {
    read(): Promise<BundleSchema | null>;
    current(): Promise<{ root: string } | null>;
    tree(): Promise<BundleNodeSchema>;
    reorder(input: ReorderInputSchema): Promise<{ path: string | null }>;
  };
  concept: {
    list(): Promise<ConceptSummarySchema[]>;
    read(path: string): Promise<ConceptSchema>;
    create(input: CreateConceptInputSchema): Promise<ConceptSchema>;
    update(input: {
      path: string;
      frontmatter: Record<string, unknown>;
      body: string;
    }): Promise<ConceptSchema>;
    delete(path: string): Promise<void>;
    rename(input: RenameConceptInputSchema): Promise<{ path: string }>;
  };
  conceptDirectory: {
    create(input: CreateConceptDirectoryInputSchema): Promise<{ path: string }>;
  };
  menu: {
    onOpenBundle(callback: () => void): () => void;
    onSignOut(callback: () => void): () => void;
  };
}

declare global {
  interface Window {
    api: AppApi;
  }
}
