import type {
  CreateTodoInput,
  Todo,
  UpdateTodoInput,
} from "@/shared/schemas/todo";

export const IPC = {
  todosList: "todos:list",
  todosGet: "todos:get",
  todosCreate: "todos:create",
  todosUpdate: "todos:update",
  todosDelete: "todos:delete",
  imagesSave: "images:save",
} as const;

export interface SaveImageInput {
  name: string;
  bytes: Uint8Array;
}

export interface AppApi {
  todos: {
    list(): Promise<Todo[]>;
    get(id: string): Promise<Todo>;
    create(input: CreateTodoInput): Promise<Todo>;
    update(id: string, input: UpdateTodoInput): Promise<Todo>;
    delete(id: string): Promise<void>;
  };
  images: {
    save(input: SaveImageInput): Promise<string>;
  };
}

declare global {
  interface Window {
    api: AppApi;
  }
}
