import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { nextUntitledName, walkMdFiles } from "@/main/lib/fs";

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "okf-fs-"));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

async function touch(rel: string): Promise<void> {
  const abs = path.join(root, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, "");
}

describe("nextUntitledName", () => {
  it("returns Untitled-0 in an empty directory", async () => {
    expect(await nextUntitledName({ absDir: root, ext: ".md" })).toBe(
      "Untitled-0.md",
    );
  });

  it("skips names that already exist", async () => {
    await touch("Untitled-0.md");
    await touch("Untitled-1.md");
    expect(await nextUntitledName({ absDir: root, ext: ".md" })).toBe(
      "Untitled-2.md",
    );
  });

  it("only considers the matching extension", async () => {
    await touch("Untitled-0.txt");
    expect(await nextUntitledName({ absDir: root, ext: ".md" })).toBe(
      "Untitled-0.md",
    );
  });

  it("fills the first available gap from zero", async () => {
    await touch("Untitled-0.md");
    await touch("Untitled-2.md");
    expect(await nextUntitledName({ absDir: root, ext: ".md" })).toBe(
      "Untitled-1.md",
    );
  });

  it("returns Untitled-0 when the directory does not exist", async () => {
    const missing = path.join(root, "does-not-exist");
    expect(await nextUntitledName({ absDir: missing, ext: ".md" })).toBe(
      "Untitled-0.md",
    );
  });
});

describe("walkMdFiles", () => {
  it("returns an empty array when there are no markdown files", async () => {
    await touch("notes.txt");
    expect(await walkMdFiles({ absDir: root })).toEqual([]);
  });

  it("collects markdown files recursively", async () => {
    await touch("a.md");
    await touch("sub/b.md");
    await touch("sub/deep/c.md");
    await touch("sub/ignore.txt");

    const result = await walkMdFiles({ absDir: root });
    expect(result.sort()).toEqual(
      [
        path.join(root, "a.md"),
        path.join(root, "sub/b.md"),
        path.join(root, "sub/deep/c.md"),
      ].sort(),
    );
  });

  it("skips dotfiles and dot-directories", async () => {
    await touch(".hidden.md");
    await touch(".config/secret.md");
    await touch("visible.md");

    expect(await walkMdFiles({ absDir: root })).toEqual([
      path.join(root, "visible.md"),
    ]);
  });

  it("skips the default ignored directories", async () => {
    await touch("node_modules/pkg/readme.md");
    await touch(".git/notes.md");
    await touch(".vite/cache.md");
    await touch("keep.md");

    expect(await walkMdFiles({ absDir: root })).toEqual([
      path.join(root, "keep.md"),
    ]);
  });

  it("honours a custom ignore set", async () => {
    await touch("dist/build.md");
    await touch("src/index.md");

    const result = await walkMdFiles({
      absDir: root,
      ignore: new Set(["dist"]),
    });
    expect(result).toEqual([path.join(root, "src/index.md")]);
  });
});
