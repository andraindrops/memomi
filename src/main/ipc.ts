import { ipcMain } from "electron";
import { IPC, type SaveImageInput } from "@/shared/ipc";
import { createTodoSchema, updateTodoSchema } from "@/shared/schemas/todo";
import { saveImage } from "@/main/services/images";
import {
  createTodo,
  deleteTodo,
  getTodo,
  listTodos,
  updateTodo,
} from "@/main/services/todo";

export const LOCAL_USER_ID = "local";

export function registerIpc(): void {
  ipcMain.handle(IPC.todosList, () => listTodos({ userId: LOCAL_USER_ID }));

  ipcMain.handle(IPC.todosGet, (_event, id: string) =>
    getTodo({ userId: LOCAL_USER_ID, id }),
  );

  ipcMain.handle(IPC.todosCreate, (_event, input: unknown) =>
    createTodo({ userId: LOCAL_USER_ID, input: createTodoSchema.parse(input) }),
  );

  ipcMain.handle(IPC.todosUpdate, (_event, id: string, input: unknown) =>
    updateTodo({
      userId: LOCAL_USER_ID,
      id,
      input: updateTodoSchema.parse(input),
    }),
  );

  ipcMain.handle(IPC.todosDelete, (_event, id: string) =>
    deleteTodo({ userId: LOCAL_USER_ID, id }),
  );

  ipcMain.handle(IPC.imagesSave, (_event, input: SaveImageInput) =>
    saveImage({ name: input.name, bytes: new Uint8Array(input.bytes) }),
  );
}
