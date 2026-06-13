import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import { getDb } from "@/main/db";
import { rowToModel } from "@/shared/lib/db";
import type {
  CreateTodoInput,
  Todo,
  UpdateTodoInput,
} from "@/shared/schemas/todo";
import { deleteImage } from "@/main/services/images";
import { NotFoundError } from "@/main/services/errors";

export async function listTodos({
  userId,
}: {
  userId: string;
}): Promise<Todo[]> {
  const rows = await getDb()
    .selectFrom("todo")
    .selectAll()
    .where("createdUserId", "=", userId)
    .orderBy("createdAt", "desc")
    .orderBy(sql`rowid`, "desc")
    .execute();
  return rows.map(rowToModel);
}

export async function getTodo({
  userId,
  id,
}: {
  userId: string;
  id: string;
}): Promise<Todo> {
  const row = await getDb()
    .selectFrom("todo")
    .selectAll()
    .where("id", "=", id)
    .where("createdUserId", "=", userId)
    .executeTakeFirst();
  if (row == null) {
    throw new NotFoundError(`Todo ${id} not found`);
  }
  return rowToModel(row);
}

export async function createTodo({
  userId,
  input,
}: {
  userId: string;
  input: CreateTodoInput;
}): Promise<Todo> {
  const now = new Date().toISOString();
  const row = await getDb()
    .insertInto("todo")
    .values({
      id: randomUUID(),
      title: input.title,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      createdUserId: userId,
      updatedUserId: userId,
      createdAt: now,
      updatedAt: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return rowToModel(row);
}

export async function updateTodo({
  userId,
  id,
  input,
}: {
  userId: string;
  id: string;
  input: UpdateTodoInput;
}): Promise<Todo> {
  const previous = await getTodo({ userId, id });
  const row = await getDb()
    .updateTable("todo")
    .set({
      ...input,
      updatedUserId: userId,
      updatedAt: new Date().toISOString(),
    })
    .where("id", "=", id)
    .where("createdUserId", "=", userId)
    .returningAll()
    .executeTakeFirst();
  if (row == null) {
    throw new NotFoundError(`Todo ${id} not found`);
  }
  const todo = rowToModel(row);
  if (input.imageUrl !== undefined) {
    await discardOldImage({
      previousUrl: previous.imageUrl,
      nextUrl: todo.imageUrl,
    });
  }
  return todo;
}

export async function deleteTodo({
  userId,
  id,
}: {
  userId: string;
  id: string;
}): Promise<void> {
  const previous = await getTodo({ userId, id });
  const result = await getDb()
    .deleteFrom("todo")
    .where("id", "=", id)
    .where("createdUserId", "=", userId)
    .executeTakeFirst();
  if (result.numDeletedRows === 0n) {
    throw new NotFoundError(`Todo ${id} not found`);
  }
  await discardOldImage({ previousUrl: previous.imageUrl, nextUrl: null });
}

async function discardOldImage({
  previousUrl,
  nextUrl,
}: {
  previousUrl: string | null;
  nextUrl: string | null;
}): Promise<void> {
  if (previousUrl == null || previousUrl === nextUrl) {
    return;
  }
  try {
    await deleteImage({ url: previousUrl });
  } catch (error) {
    console.error(`Failed to delete image ${previousUrl}`, error);
  }
}
