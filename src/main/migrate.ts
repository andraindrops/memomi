import type { Kysely } from "kysely";
import type { DB } from "@/shared/db-types";

export async function migrate(db: Kysely<DB>): Promise<void> {
  await db.schema
    .createTable("todo")
    .ifNotExists()
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("description", "text")
    .addColumn("image_url", "text")
    .addColumn("created_user_id", "text", (col) => col.notNull())
    .addColumn("updated_user_id", "text", (col) => col.notNull())
    .addColumn("created_at", "text", (col) => col.notNull())
    .addColumn("updated_at", "text", (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex("todo_created_user_id_index")
    .ifNotExists()
    .on("todo")
    .column("created_user_id")
    .execute();
}
