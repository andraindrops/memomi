import { contextBridge, ipcRenderer } from "electron";
import { IPC, type AppApi, type SaveImageInput } from "@/shared/ipc";
import type { CreateTodoInput, UpdateTodoInput } from "@/shared/schemas/todo";

const api: AppApi = {
  todos: {
    list: () => ipcRenderer.invoke(IPC.todosList),
    get: (id: string) => ipcRenderer.invoke(IPC.todosGet, id),
    create: (input: CreateTodoInput) =>
      ipcRenderer.invoke(IPC.todosCreate, input),
    update: (id: string, input: UpdateTodoInput) =>
      ipcRenderer.invoke(IPC.todosUpdate, id, input),
    delete: (id: string) => ipcRenderer.invoke(IPC.todosDelete, id),
  },
  images: {
    save: (input: SaveImageInput) => ipcRenderer.invoke(IPC.imagesSave, input),
  },
};

contextBridge.exposeInMainWorld("api", api);
