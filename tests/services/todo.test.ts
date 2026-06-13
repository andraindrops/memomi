import Database from "better-sqlite3";
import type { Kysely } from "kysely";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb, setDb } from "@/main/db";
import { migrate } from "@/main/migrate";
import { NotFoundError } from "@/main/services/errors";
import {
  createTodo,
  deleteTodo,
  getTodo,
  listTodos,
  updateTodo,
} from "@/main/services/todo";
import type { DB } from "@/shared/db-types";

const USER_1 = "user-1-id";
const USER_2 = "user-2-id";

let db: Kysely<DB>;

beforeEach(async () => {
  db = createDb(new Database(":memory:"));
  setDb(db);
  await migrate(db);
});

afterEach(async () => {
  await db.destroy();
});

describe("Todo service (real in-memory SQLite)", () => {
  describe("CRUD", () => {
    it("creates a todo and sets the creator and updater", async () => {
      const todo = await createTodo({
        userId: USER_1,
        input: { title: "Test Todo 1", description: "Test Description 1" },
      });
      expect(todo).toMatchObject({
        title: "Test Todo 1",
        description: "Test Description 1",
        createdUserId: USER_1,
        updatedUserId: USER_1,
      });
      expect(typeof todo.id).toBe("string");
    });

    it("returns todos newest first", async () => {
      await createTodo({ userId: USER_1, input: { title: "Test Todo 1" } });
      await createTodo({ userId: USER_1, input: { title: "Test Todo 2" } });

      const todos = await listTodos({ userId: USER_1 });
      expect(todos.map((todo) => todo.title)).toEqual([
        "Test Todo 2",
        "Test Todo 1",
      ]);
    });

    it("returns a todo by id", async () => {
      const created = await createTodo({
        userId: USER_1,
        input: { title: "Test Todo 1" },
      });

      const todo = await getTodo({ userId: USER_1, id: created.id });
      expect(todo).toMatchObject({ id: created.id, title: "Test Todo 1" });
    });

    it("throws error when the id does not exist", async () => {
      await expect(
        getTodo({ userId: USER_1, id: "00000000-0000-0000-0000-000000000000" }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("updates a todo", async () => {
      const created = await createTodo({
        userId: USER_1,
        input: { title: "Test Todo 1" },
      });

      const updated = await updateTodo({
        userId: USER_1,
        id: created.id,
        input: {
          title: "[Mutated] Test Todo 1",
          description: "[Mutated] Test Description 1",
        },
      });
      expect(updated).toMatchObject({
        id: created.id,
        title: "[Mutated] Test Todo 1",
        description: "[Mutated] Test Description 1",
      });

      expect((await getTodo({ userId: USER_1, id: created.id })).title).toBe(
        "[Mutated] Test Todo 1",
      );
    });

    it("removes a todo", async () => {
      const created = await createTodo({
        userId: USER_1,
        input: { title: "Test Todo 1" },
      });

      await expect(
        deleteTodo({ userId: USER_1, id: created.id }),
      ).resolves.toBeUndefined();
      await expect(
        getTodo({ userId: USER_1, id: created.id }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("isolation between users", () => {
    async function user1Creates() {
      return createTodo({ userId: USER_1, input: { title: "Test Todo 1" } });
    }

    it("does [not] show user 1's todo in user 2's list", async () => {
      await user1Creates();

      expect(await listTodos({ userId: USER_2 })).toEqual([]);
      expect(await listTodos({ userId: USER_1 })).toHaveLength(1);
    });

    it("does [not] let user 2 fetch user 1's todo", async () => {
      const todo = await user1Creates();

      await expect(
        getTodo({ userId: USER_2, id: todo.id }),
      ).rejects.toBeInstanceOf(NotFoundError);
      await expect(
        getTodo({ userId: USER_1, id: todo.id }),
      ).resolves.toMatchObject({ id: todo.id });
    });

    it("does [not] let user 2 update user 1's todo", async () => {
      const todo = await user1Creates();

      await expect(
        updateTodo({
          userId: USER_2,
          id: todo.id,
          input: { title: "[Mutated] Test Todo 1" },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect((await getTodo({ userId: USER_1, id: todo.id })).title).toBe(
        "Test Todo 1",
      );
    });

    it("does [not] let user 2 delete user 1's todo", async () => {
      const todo = await user1Creates();

      await expect(
        deleteTodo({ userId: USER_2, id: todo.id }),
      ).rejects.toBeInstanceOf(NotFoundError);
      await expect(
        getTodo({ userId: USER_1, id: todo.id }),
      ).resolves.toMatchObject({ id: todo.id });
    });
  });
});
