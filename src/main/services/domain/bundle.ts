import { promises as fs } from "node:fs";
import path from "node:path";
import { dialog } from "electron";
import type {
  BundleSchema,
  BundleNodeSchema,
  ReorderInputSchema,
} from "@/shared/schemas/bundle";
import {
  getBundleRoot,
  requireBundleRoot,
  setBundleRoot,
} from "@/main/states/bundle";
import {
  assertSafeName,
  normalizeBundlePath,
  resolveSafe,
  toBundlePath,
} from "@/main/lib/paths";
import { IGNORED_DIRS } from "@/main/lib/fs";
import { isMarkdownFile } from "@/main/lib/markdown";
import { readOrder, writeOrder } from "@/main/lib/order";
import { updateLinks } from "@/main/services/domain/references";
import { AppError, NotFoundError } from "@/main/lib/errors";

export async function readBundle(): Promise<BundleSchema | null> {
  const result = await dialog.showOpenDialog({
    title: "Open OKF Bundle",
    properties: ["openDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  const root = result.filePaths[0];
  setCurrentBundle({ root });
  const tree = await listBundleTree();
  return { root, tree };
}

export async function listBundleTree(): Promise<BundleNodeSchema> {
  const root = requireCurrentBundleRoot();
  return buildTree({ root, absDir: root });
}

export function getCurrentBundle(): { root: string } | null {
  const root = getBundleRoot();
  return root == null ? null : { root };
}

export function setCurrentBundle({ root }: { root: string | null }): void {
  setBundleRoot(root);
}

export function requireCurrentBundleRoot(): string {
  return requireBundleRoot();
}

async function buildTree({
  root,
  absDir,
}: {
  root: string;
  absDir: string;
}): Promise<BundleNodeSchema> {
  const entries = await fs.readdir(absDir, { withFileTypes: true });
  const children: BundleNodeSchema[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") || IGNORED_DIRS.has(entry.name)) {
      continue;
    }
    const absChild = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      children.push(await buildTree({ root, absDir: absChild }));
    } else if (entry.isFile() && isMarkdownFile({ fileName: entry.name })) {
      children.push({
        name: entry.name,
        path: toBundlePath({ root, absPath: absChild }),
        kind: classifyFile({ fileName: entry.name }),
      });
    }
  }

  sortChildren({ children, order: await readOrder({ absDir }) });

  return {
    name: path.basename(absDir),
    path: toBundlePath({ root, absPath: absDir }),
    kind: "directory",
    children,
  };
}

// Children listed in the directory's `.order.json` come first, in that order.
// Unknown names (newly created, etc.) fall back to the default ordering at the
// end; names in the manifest that no longer exist are ignored.
function sortChildren({
  children,
  order,
}: {
  children: BundleNodeSchema[];
  order: string[];
}): void {
  const rank = new Map(order.map((name, index) => [name, index]));
  children.sort((a, b) => {
    const ra = rank.get(a.name);
    const rb = rank.get(b.name);
    if (ra != null && rb != null) return ra - rb;
    if (ra != null) return -1;
    if (rb != null) return 1;
    return defaultCompare(a, b);
  });
}

function defaultCompare(a: BundleNodeSchema, b: BundleNodeSchema): number {
  const aDir = a.kind === "directory" ? 0 : 1;
  const bDir = b.kind === "directory" ? 0 : 1;
  if (aDir !== bDir) return aDir - bDir;
  return a.name.localeCompare(b.name);
}

// Make `directory` hold `orderedNames` in this order. When `movedPath` lives in
// another directory it is moved in first (a drag across folders); when it is
// already a child — or omitted — this is a plain in-place reorder. Returns the
// moved entry's new path, or null when nothing was moved.
export async function reorder({
  directory,
  orderedNames,
  movedPath,
}: ReorderInputSchema): Promise<{ path: string | null }> {
  const root = requireCurrentBundleRoot();
  const dirBundlePath = normalizeBundlePath({ path: directory });
  const absDir = resolveSafe({ root, relPath: dirBundlePath });

  let stat;
  try {
    stat = await fs.stat(absDir);
  } catch {
    throw new NotFoundError(`${dirBundlePath} not found`);
  }
  if (!stat.isDirectory()) {
    throw new NotFoundError(`${dirBundlePath} is not a directory`);
  }

  const newPath =
    movedPath == null
      ? null
      : await moveInto({
          root,
          sourcePath: movedPath,
          targetDirBundlePath: dirBundlePath,
        });

  for (const name of orderedNames) assertSafeName({ name });
  await writeOrder({ absDir, order: orderedNames });
  return { path: newPath };
}

// Move `sourcePath` into `targetDirBundlePath` and prune it from its old
// directory's manifest. Returns the new bundle path, or null when the entry is
// already a direct child of the target (nothing to move).
async function moveInto({
  root,
  sourcePath,
  targetDirBundlePath,
}: {
  root: string;
  sourcePath: string;
  targetDirBundlePath: string;
}): Promise<string | null> {
  const sourceBundlePath = normalizeBundlePath({ path: sourcePath });
  if (path.posix.dirname(sourceBundlePath) === targetDirBundlePath) return null;

  // Disallow moving a directory into itself or one of its descendants.
  if (
    targetDirBundlePath === sourceBundlePath ||
    targetDirBundlePath.startsWith(`${sourceBundlePath}/`)
  ) {
    throw new AppError("Cannot move a folder into itself");
  }

  const sourceAbs = resolveSafe({ root, relPath: sourceBundlePath });
  try {
    await fs.stat(sourceAbs);
  } catch {
    throw new NotFoundError(`${sourceBundlePath} not found`);
  }

  const name = path.posix.basename(sourceBundlePath);
  const newBundlePath = normalizeBundlePath({
    path: path.posix.join(targetDirBundlePath, name),
  });
  const newAbs = resolveSafe({ root, relPath: newBundlePath });

  try {
    await fs.access(newAbs);
    throw new AppError(`A file already exists at ${newBundlePath}`);
  } catch (error) {
    if (error instanceof AppError) throw error;
  }

  await fs.rename(sourceAbs, newAbs);
  await updateLinks({
    root,
    from: sourceBundlePath,
    to: newBundlePath,
  });

  const sourceParentAbs = path.dirname(sourceAbs);
  const sourceOrder = await readOrder({ absDir: sourceParentAbs });
  if (sourceOrder.includes(name)) {
    await writeOrder({
      absDir: sourceParentAbs,
      order: sourceOrder.filter((n) => n !== name),
    });
  }

  return newBundlePath;
}

function classifyFile({
  fileName,
}: {
  fileName: string;
}): BundleNodeSchema["kind"] {
  if (fileName === "index.md") return "index";
  if (fileName === "log.md") return "log";
  return "concept";
}
