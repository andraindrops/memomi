import { promises as fs } from "node:fs";
import path from "node:path";
import { isMarkdownFile } from "@/main/lib/markdown";
import { AppError } from "@/main/lib/errors";

export const IGNORED_DIRS = new Set([".git", "node_modules", ".vite"]);

export async function assertDoesNotExist({
  absPath,
  message,
}: {
  absPath: string;
  message: string;
}): Promise<void> {
  try {
    await fs.access(absPath);
    throw new AppError(message);
  } catch (error) {
    if (error instanceof AppError) throw error;
  }
}

export async function walkMdFiles({
  absDir,
  ignore = IGNORED_DIRS,
}: {
  absDir: string;
  ignore?: Set<string>;
}): Promise<string[]> {
  const entries = await fs.readdir(absDir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || ignore.has(entry.name)) continue;
    const absChild = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkMdFiles({ absDir: absChild, ignore })));
    } else if (entry.isFile() && isMarkdownFile({ fileName: entry.name })) {
      files.push(absChild);
    }
  }
  return files;
}
