import { promises as fs } from "node:fs";
import path from "node:path";
import { dialog } from "electron";
import type { BundleSchema, BundleNodeSchema } from "@/shared/schemas/bundle";
import {
  getBundleRoot,
  requireBundleRoot,
  setBundleRoot,
} from "@/main/states/bundle";
import { toBundlePath } from "@/main/lib/paths";
import { IGNORED_DIRS } from "@/main/lib/fs";
import { isMarkdownFile } from "@/main/lib/markdown";

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

  children.sort((a, b) => {
    const aDir = a.kind === "directory" ? 0 : 1;
    const bDir = b.kind === "directory" ? 0 : 1;
    if (aDir !== bDir) return aDir - bDir;
    return a.name.localeCompare(b.name);
  });

  return {
    name: path.basename(absDir),
    path: toBundlePath({ root, absPath: absDir }),
    kind: "directory",
    children,
  };
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
