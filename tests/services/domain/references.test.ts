import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { deleteLinks, updateLinks } from "@/main/services/domain/references";

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "okf-refs-"));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

async function write(rel: string, content: string): Promise<void> {
  const abs = path.join(root, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf8");
}

async function read(rel: string): Promise<string> {
  return fs.readFile(path.join(root, rel), "utf8");
}

describe("updateLinks", () => {
  it("rewrites page links pointing at a renamed file", async () => {
    await write("a.md", "See [Orders](@/orders.md) for details.\n");
    await write("b.md", "Also [the orders](@/orders.md#section) here.\n");

    const changed = await updateLinks({
      root,
      from: "/orders.md",
      to: "/sales-orders.md",
    });

    expect(changed.sort()).toEqual(["/a.md", "/b.md"]);
    expect(await read("a.md")).toBe(
      "See [Orders](@/sales-orders.md) for details.\n",
    );
    expect(await read("b.md")).toBe(
      "Also [the orders](@/sales-orders.md#section) here.\n",
    );
  });

  it("rewrites descendant links when a directory moves", async () => {
    await write("ref.md", "Link to [x](@/old/sub/x.md).\n");

    const changed = await updateLinks({
      root,
      from: "/old",
      to: "/new/place",
    });

    expect(changed).toEqual(["/ref.md"]);
    expect(await read("ref.md")).toBe("Link to [x](@/new/place/sub/x.md).\n");
  });

  it("rewrites links everywhere, including inside code", async () => {
    const body =
      "Real [x](@/x.md).\n\n" +
      "Inline `[x](@/x.md)` too.\n\n" +
      "```\n[x](@/x.md)\n```\n";
    await write("doc.md", body);

    await updateLinks({ root, from: "/x.md", to: "/y.md" });

    const out = await read("doc.md");
    expect(out).toContain("Real [x](@/y.md).");
    expect(out).toContain("Inline `[x](@/y.md)` too.");
    expect(out).toContain("```\n[x](@/y.md)\n```");
  });

  it("ignores destinations that are not internal page links (e.g. plain links)", async () => {
    await write("doc.md", "External [x](/x.md) and internal [y](@/x.md).\n");

    await updateLinks({ root, from: "/x.md", to: "/y.md" });

    const out = await read("doc.md");
    expect(out).toContain("[x](/x.md)");
    expect(out).toContain("[y](@/y.md)");
  });

  it("leaves files without matching links byte-for-byte unchanged", async () => {
    const original = "Nothing to see, [other](@/other.md).\n";
    await write("doc.md", original);

    const changed = await updateLinks({
      root,
      from: "/x.md",
      to: "/y.md",
    });

    expect(changed).toEqual([]);
    expect(await read("doc.md")).toBe(original);
  });
});

describe("deleteLinks", () => {
  it("unwraps links to a deleted file, leaving their label text", async () => {
    await write("a.md", "See [Orders](@/orders.md) now.\n");

    const changed = await deleteLinks({ root, target: "/orders.md" });

    expect(changed).toEqual(["/a.md"]);
    expect(await read("a.md")).toBe("See Orders now.\n");
  });

  it("unwraps links to descendants of a deleted directory", async () => {
    await write("a.md", "Gone: [child](@/dir/child.md).\n");

    await deleteLinks({ root, target: "/dir" });

    expect(await read("a.md")).toBe("Gone: child.\n");
  });

  it("does not touch links to surviving files", async () => {
    const original = "Keep [this](@/keep.md).\n";
    await write("a.md", original);

    const changed = await deleteLinks({ root, target: "/gone.md" });

    expect(changed).toEqual([]);
    expect(await read("a.md")).toBe(original);
  });
});
