import { promises as fs } from "node:fs";
import path from "node:path";

// Per-directory manifest holding the user-defined order of that directory's
// immediate children (by name). Dot-prefixed so it is excluded from the tree
// by the existing dotfile filter.
export const ORDER_FILE_NAME = ".order.json";

export async function readOrder({
  absDir,
}: {
  absDir: string;
}): Promise<string[]> {
  try {
    const raw = await fs.readFile(path.join(absDir, ORDER_FILE_NAME), "utf8");
    const parsed: unknown = JSON.parse(raw);
    const order = (parsed as { order?: unknown }).order;
    if (!Array.isArray(order)) return [];
    return order.filter((name): name is string => typeof name === "string");
  } catch {
    return [];
  }
}

export async function writeOrder({
  absDir,
  order,
}: {
  absDir: string;
  order: string[];
}): Promise<void> {
  const file = path.join(absDir, ORDER_FILE_NAME);
  await fs.writeFile(file, `${JSON.stringify({ order }, null, 2)}\n`, "utf8");
}
