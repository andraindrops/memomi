import type Database from "better-sqlite3";
import { CamelCasePlugin, Kysely, SqliteDialect } from "kysely";
import type { DB } from "@/shared/db-types";

export function createDb(database: Database.Database): Kysely<DB> {
  return new Kysely<DB>({
    dialect: new SqliteDialect({ database }),
    plugins: [new CamelCasePlugin()],
  });
}

let activeDb: Kysely<DB> | null = null;

export function setDb(db: Kysely<DB>): void {
  activeDb = db;
}

export function getDb(): Kysely<DB> {
  if (activeDb == null) {
    throw new Error("Database has not been initialized. Call setDb() first.");
  }
  return activeDb;
}
