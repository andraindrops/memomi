import { ipcMain } from "electron";
import { IPC } from "@/shared/ipc";
import {
  createConceptInputZodSchema,
  createConceptDirectoryInputZodSchema,
  deleteConceptInputZodSchema,
  readConceptInputZodSchema,
  renameConceptInputZodSchema,
  updateConceptInputZodSchema,
} from "@/shared/schemas/concept";
import { reorderInputZodSchema } from "@/shared/schemas/bundle";
import {
  getCurrentBundle,
  readBundle,
  listBundleTree,
  reorder,
} from "@/main/services/domain/bundle";
import {
  createConcept,
  createConceptDirectory,
  deleteConcept,
  listConcepts,
  readConcept,
  renameConcept,
  updateConcept,
} from "@/main/services/domain/concept";

// prettier-ignore
export function registerIpc(): void {
  ipcMain.handle(IPC.bundleRead,    () => readBundle());
  ipcMain.handle(IPC.bundleCurrent, () => getCurrentBundle());
  ipcMain.handle(IPC.bundleTree,    () => listBundleTree());
  ipcMain.handle(IPC.bundleReorder, (_e, input: unknown) => reorder(reorderInputZodSchema.parse(input)));

  ipcMain.handle(IPC.conceptList,   ()                   => listConcepts());
  ipcMain.handle(IPC.conceptRead,   (_e, path: unknown)  => readConcept(readConceptInputZodSchema.parse({ path })));
  ipcMain.handle(IPC.conceptCreate, (_e, input: unknown) => createConcept(createConceptInputZodSchema.parse(input)));
  ipcMain.handle(IPC.conceptUpdate, (_e, input: unknown) => updateConcept(updateConceptInputZodSchema.parse(input)));
  ipcMain.handle(IPC.conceptDelete, (_e, path: unknown)  => deleteConcept(deleteConceptInputZodSchema.parse({ path })));
  ipcMain.handle(IPC.conceptRename, (_e, input: unknown) => renameConcept(renameConceptInputZodSchema.parse(input)));

  ipcMain.handle(IPC.conceptDirectoryCreate, (_e, input: unknown) => createConceptDirectory(createConceptDirectoryInputZodSchema.parse(input)));
}
