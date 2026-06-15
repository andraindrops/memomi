import { promises as fs } from "node:fs";
import path from "node:path";
import { isMarkdownFile } from "@/main/lib/markdown";

export const IGNORED_DIRS = new Set([".git", "node_modules", ".vite"]);

export async function nextUntitledName({
  absDir,
  ext,
}: {
  absDir: string;
  ext: string;
}): Promise<string> {
  let existing: Set<string>;
  try {
    existing = new Set(await fs.readdir(absDir));
  } catch {
    existing = new Set();
  }
  for (let i = 0; ; i++) {
    const candidate = `Untitled-${i}${ext}`;
    if (!existing.has(candidate)) return candidate;
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
