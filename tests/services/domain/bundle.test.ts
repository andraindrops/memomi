import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  listBundleTree,
  reorder,
  setCurrentBundle,
} from "@/main/services/domain/bundle";
import {
  createConcept,
  readConcept,
  renameConcept,
  updateConcept,
} from "@/main/services/domain/concept";
import { ORDER_FILE_NAME } from "@/main/lib/order";
import { AppError, NotFoundError, PathTraversalError } from "@/main/lib/errors";

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "okf-bundle-"));
  setCurrentBundle({ root });
});

afterEach(async () => {
  setCurrentBundle({ root: null });
  await fs.rm(root, { recursive: true, force: true });
});

async function touch(rel: string): Promise<void> {
  const abs = path.join(root, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, "");
}

function names(): Promise<string[]> {
  return listBundleTree().then((tree) =>
    (tree.children ?? []).map((c) => c.name),
  );
}

describe("bundle tree ordering", () => {
  it("defaults to directories first, then alphabetical", async () => {
    await touch("b.md");
    await touch("a.md");
    await touch("zeta/x.md");
    expect(await names()).toEqual(["zeta", "a.md", "b.md"]);
  });

  it("follows .order.json, allowing files and directories to interleave", async () => {
    await touch("a.md");
    await touch("b.md");
    await touch("docs/x.md");
    await reorder({
      directory: "/",
      orderedNames: ["b.md", "docs", "a.md"],
    });
    expect(await names()).toEqual(["b.md", "docs", "a.md"]);
  });

  it("appends names missing from the manifest using the default order", async () => {
    await touch("a.md");
    await touch("b.md");
    await touch("c.md");
    await reorder({ directory: "/", orderedNames: ["c.md"] });
    // c.md is pinned first; a.md and b.md fall back to alphabetical.
    expect(await names()).toEqual(["c.md", "a.md", "b.md"]);
  });

  it("ignores manifest entries that no longer exist", async () => {
    await touch("a.md");
    await reorder({
      directory: "/",
      orderedNames: ["ghost.md", "a.md"],
    });
    expect(await names()).toEqual(["a.md"]);
  });

  it("does not surface the .order.json manifest as a tree node", async () => {
    await touch("a.md");
    await reorder({ directory: "/", orderedNames: ["a.md"] });
    expect(await names()).toEqual(["a.md"]);
    const onDisk = await fs.readFile(path.join(root, ORDER_FILE_NAME), "utf8");
    expect(JSON.parse(onDisk)).toEqual({ order: ["a.md"] });
  });
});

describe("reorder", () => {
  it("rejects names that escape the directory", async () => {
    await expect(
      reorder({ directory: "/", orderedNames: ["../evil.md"] }),
    ).rejects.toBeInstanceOf(PathTraversalError);
  });

  it("rejects a missing directory", async () => {
    await expect(
      reorder({ directory: "/nope", orderedNames: [] }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("reorder with movedPath (cross-directory move)", () => {
  it("moves a file into another directory and applies the target order", async () => {
    await touch("a.md");
    await touch("docs/x.md");
    const { path: newPath } = await reorder({
      directory: "/docs",
      orderedNames: ["a.md", "x.md"],
      movedPath: "/a.md",
    });
    expect(newPath).toBe("/docs/a.md");

    const tree = await listBundleTree();
    const docs = (tree.children ?? []).find((c) => c.name === "docs");
    expect((docs?.children ?? []).map((c) => c.name)).toEqual(["a.md", "x.md"]);
    // a.md no longer at the root.
    expect((tree.children ?? []).map((c) => c.name)).toEqual(["docs"]);
  });

  it("rewrites links in other concepts when a file moves directories", async () => {
    await createConcept({ directory: "/", fileName: "a" });
    await createConcept({ directory: "/docs", fileName: "x" });
    await updateConcept({
      path: "/docs/x.md",
      frontmatter: {},
      body: "Link to [a](/a.md).",
    });

    await reorder({
      directory: "/docs",
      orderedNames: ["a.md", "x.md"],
      movedPath: "/a.md",
    });

    const x = await readConcept({ path: "/docs/x.md" });
    expect(x.body).toContain("[a](/docs/a.md)");
  });

  it("returns null path and only writes order when movedPath is already a child", async () => {
    await touch("a.md");
    await touch("b.md");
    const { path: newPath } = await reorder({
      directory: "/",
      orderedNames: ["b.md", "a.md"],
      movedPath: "/a.md",
    });
    expect(newPath).toBeNull();
    expect(await names()).toEqual(["b.md", "a.md"]);
  });

  it("prunes the moved entry from the source directory's manifest", async () => {
    await touch("a.md");
    await touch("b.md");
    await touch("docs/x.md");
    await reorder({
      directory: "/",
      orderedNames: ["a.md", "b.md", "docs"],
    });
    await reorder({
      directory: "/docs",
      orderedNames: ["x.md", "a.md"],
      movedPath: "/a.md",
    });

    const rootOrder = JSON.parse(
      await fs.readFile(path.join(root, ORDER_FILE_NAME), "utf8"),
    );
    expect(rootOrder.order).toEqual(["b.md", "docs"]);
  });

  it("rejects moving a folder into its own descendant", async () => {
    await touch("parent/child/x.md");
    await expect(
      reorder({
        directory: "/parent/child",
        orderedNames: [],
        movedPath: "/parent",
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("rejects a move that collides with an existing name", async () => {
    await touch("a.md");
    await touch("docs/a.md");
    await expect(
      reorder({
        directory: "/docs",
        orderedNames: ["a.md"],
        movedPath: "/a.md",
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("rejects a missing target directory", async () => {
    await touch("a.md");
    await expect(
      reorder({ directory: "/nope", orderedNames: [], movedPath: "/a.md" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("rename keeps order position", () => {
  it("swaps the renamed entry in the manifest", async () => {
    await createConcept({ directory: "/", fileName: "a" });
    await createConcept({ directory: "/", fileName: "b" });
    await reorder({
      directory: "/",
      orderedNames: ["b.md", "a.md"],
    });
    await renameConcept({ path: "/b.md", newName: "renamed" });
    expect(await names()).toEqual(["renamed.md", "a.md"]);
  });
});
