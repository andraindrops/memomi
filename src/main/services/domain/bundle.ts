import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
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
import { assertDoesNotExist, IGNORED_DIRS } from "@/main/lib/fs";
import { isMarkdownFile } from "@/main/lib/markdown";
import { readOrder, writeOrder } from "@/main/lib/order";
import { updateLinks } from "@/main/services/domain/references";
import { deriveTitle, parseConcept } from "@/main/services/domain/concept";
import { seedExampleConcepts } from "@/main/services/domain/example-seed";
import { AppError, NotFoundError } from "@/main/lib/errors";

export const DEFAULT_BUNDLE_ROOT =
  process.env.MEMOMI_BUNDLE_ROOT ??
  path.join(os.homedir(), ".memomi", "bundle");

export async function openDefaultBundle(): Promise<BundleSchema> {
  await fs.mkdir(DEFAULT_BUNDLE_ROOT, { recursive: true });
  await seedExampleConcepts({ root: DEFAULT_BUNDLE_ROOT });
  setCurrentBundle({ root: DEFAULT_BUNDLE_ROOT });
  const tree = await listBundleTree();
  return { root: DEFAULT_BUNDLE_ROOT, tree };
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
  setBundleRoot({ dir: root });
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
        title: await readFileTitle({ abs: absChild, fileName: entry.name }),
        kind: classifyFile({ fileName: entry.name }),
      });
    }
  }

  sortChildren({ children, order: await readOrder({ absDir }) });

  const name = path.basename(absDir);
  return {
    name,
    path: toBundlePath({ root, absPath: absDir }),
    // A directory's display name is its index.md title.
    title: children.find((c) => c.kind === "index")?.title ?? name,
    kind: "directory",
    children,
  };
}

async function readFileTitle({
  abs,
  fileName,
}: {
  abs: string;
  fileName: string;
}): Promise<string> {
  try {
    const raw = await fs.readFile(abs, "utf8");
    const { frontmatter, body } = parseConcept({ raw });
    return deriveTitle({ frontmatter, body, fileName });
  } catch {
    return fileName.replace(/\.md$/i, "");
  }
}

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

  await assertDoesNotExist({
    absPath: newAbs,
    message: `A file already exists at ${newBundlePath}`,
  });

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
