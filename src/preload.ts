import { contextBridge, ipcRenderer } from "electron";
import { IPC, type AppApi } from "@/shared/ipc";
import type { ReorderInputSchema } from "@/shared/schemas/bundle";
import type {
  CreateConceptInputSchema,
  CreateConceptDirectoryInputSchema,
  RenameConceptInputSchema,
} from "@/shared/schemas/concept";

// prettier-ignore
const api: AppApi = {
  bundle: {
    current: () => ipcRenderer.invoke(IPC.bundleCurrent),
    tree:    () => ipcRenderer.invoke(IPC.bundleTree),
    reorder: (input: ReorderInputSchema) => ipcRenderer.invoke(IPC.bundleReorder, input),
  },
  concept: {
    list:   ()                                => ipcRenderer.invoke(IPC.conceptList),
    read:   ({ path }: { path: string })      => ipcRenderer.invoke(IPC.conceptRead,   path),
    create: (input: CreateConceptInputSchema) => ipcRenderer.invoke(IPC.conceptCreate, input),
    update: (input)                           => ipcRenderer.invoke(IPC.conceptUpdate, input),
    delete: ({ path }: { path: string })      => ipcRenderer.invoke(IPC.conceptDelete, path),
    rename: (input: RenameConceptInputSchema) => ipcRenderer.invoke(IPC.conceptRename, input),
  },
  conceptDirectory: {
    create: (input: CreateConceptDirectoryInputSchema) => ipcRenderer.invoke(IPC.conceptDirectoryCreate, input),
  },
};

contextBridge.exposeInMainWorld("api", api);
