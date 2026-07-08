import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { setCurrentBundle } from "@/main/services/domain/bundle";
import {
  createConcept,
  createConceptDirectory,
  deleteConcept,
  listConcepts,
  parseConcept,
  readConcept,
  renameConcept,
  serializeConcept,
  updateConcept,
} from "@/main/services/domain/concept";
import { UnparseableFrontmatterError } from "@/main/lib/errors";

let root: string;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "okf-test-"));
  setCurrentBundle({ root });
});

afterEach(async () => {
  setCurrentBundle({ root: null });
  await fs.rm(root, { recursive: true, force: true });
});

describe("concept service", () => {
  it("creates a concept as a UUID-named file with default frontmatter", async () => {
    const concept = await createConcept({
      directory: "/domains/sales",
      title: "Orders",
    });
    expect(concept.directory).toBe("/domains/sales");
    expect(concept.fileName).toMatch(/^[0-9a-f-]{36}\.md$/);
    expect(UUID_RE.test(concept.fileName.replace(/\.md$/, ""))).toBe(true);
    expect(concept.type).toBe("Concept");
    expect(concept.title).toBe("Orders");

    const onDisk = await fs.readFile(
      path.join(root, concept.path.slice(1)),
      "utf8",
    );
    expect(onDisk).toContain("type:");
    expect(onDisk).toContain("title: Orders");
  });

  it("defaults the title to Untitled", async () => {
    const concept = await createConcept({ directory: "/" });
    expect(concept.title).toBe("Untitled");
    expect(concept.frontmatter.title).toBe("Untitled");
  });

  it("preserves unknown frontmatter keys across a write", async () => {
    const created = await createConcept({ directory: "/" });
    const concept = await readConcept({ path: created.path });
    const updated = await updateConcept({
      path: created.path,
      frontmatter: { ...concept.frontmatter, customKey: "value" },
      body: "# A\n\nUpdated.",
    });
    expect(updated.frontmatter.customKey).toBe("value");

    const reread = await readConcept({ path: created.path });
    expect(reread.frontmatter.customKey).toBe("value");
    expect(reread.body).toBe("# A\n\nUpdated.\n");
  });

  it("lists concepts as summaries", async () => {
    const a = await createConcept({ directory: "/", title: "Alpha" });
    const b = await createConcept({ directory: "/sub", title: "Beta" });
    const list = await listConcepts();
    const paths = list.map((c) => c.path);
    expect(paths).toContain(a.path);
    expect(paths).toContain(b.path);
    const titles = list.map((c) => c.title);
    expect(titles).toContain("Alpha");
    expect(titles).toContain("Beta");
  });

  it("deletes a concept", async () => {
    const concept = await createConcept({ directory: "/" });
    await deleteConcept({ path: concept.path });
    await expect(readConcept({ path: concept.path })).rejects.toThrow();
  });

  it("deletes a directory and its contents recursively", async () => {
    const { path: dirPath } = await createConceptDirectory({
      parent: "/",
      name: "sub",
    });
    const nested = await createConcept({ directory: dirPath });
    await deleteConcept({ path: dirPath });
    await expect(readConcept({ path: nested.path })).rejects.toThrow();
    expect(await listConcepts()).toHaveLength(0);
  });

  it("throws when deleting a missing entry", async () => {
    await expect(deleteConcept({ path: "/nope.md" })).rejects.toThrow();
  });

  it("creates a directory as a UUID name holding the display name in index.md", async () => {
    const { path: dirPath } = await createConceptDirectory({
      parent: "/",
      name: "sales",
    });
    expect(UUID_RE.test(path.posix.basename(dirPath))).toBe(true);

    const index = await readConcept({ path: `${dirPath}/index.md` });
    expect(index.isIndex).toBe(true);
    expect(index.type).toBe("Index");
    expect(index.frontmatter.title).toBe("sales");
    expect(index.body).toContain("# Section");
    expect(index.body).toContain("](@/path/to/url-1)");

    const log = await readConcept({ path: `${dirPath}/log.md` });
    expect(log.isLog).toBe(true);
    expect(log.type).toBe("Log");
    expect(log.frontmatter.title).toBe("sales Log");
    expect(log.body).toContain("# Directory Update Log");
  });

  it("defaults the directory display name to Untitled", async () => {
    const { path: dirPath } = await createConceptDirectory({ parent: "/" });
    const index = await readConcept({ path: `${dirPath}/index.md` });
    expect(index.frontmatter.title).toBe("Untitled");
  });

  it("renames a concept by rewriting its frontmatter title only", async () => {
    const concept = await createConcept({ directory: "/", title: "A" });
    const { path: result } = await renameConcept({
      path: concept.path,
      newName: "Sales Orders",
    });
    expect(result).toBe(concept.path);
    const reread = await readConcept({ path: concept.path });
    expect(reread.frontmatter.title).toBe("Sales Orders");
    expect(reread.title).toBe("Sales Orders");
  });

  it("keeps path separators verbatim in a renamed title", async () => {
    const concept = await createConcept({ directory: "/", title: "A" });
    const { path: result } = await renameConcept({
      path: concept.path,
      newName: "x/y",
    });
    expect(result).toBe(concept.path);
    const reread = await readConcept({ path: concept.path });
    expect(reread.frontmatter.title).toBe("x/y");
  });

  it("renames a directory by rewriting its index.md title, keeping the path", async () => {
    const { path: dirPath } = await createConceptDirectory({
      parent: "/",
      name: "sales",
    });
    const { path: result } = await renameConcept({
      path: dirPath,
      newName: "tables",
    });
    expect(result).toBe(dirPath);
    const index = await readConcept({ path: `${dirPath}/index.md` });
    expect(index.frontmatter.title).toBe("tables");
    expect(index.body).toContain("# Section");
  });

  it("creates index.md when renaming a directory that lacks one", async () => {
    await fs.mkdir(path.join(root, "bare"), { recursive: true });
    const { path: result } = await renameConcept({
      path: "/bare",
      newName: "Named",
    });
    expect(result).toBe("/bare");
    const index = await readConcept({ path: "/bare/index.md" });
    expect(index.frontmatter.title).toBe("Named");
  });

  it("rejects an empty rename", async () => {
    const concept = await createConcept({ directory: "/" });
    await expect(
      renameConcept({ path: concept.path, newName: "   " }),
    ).rejects.toThrow();
  });

  it("throws when renaming a missing entry", async () => {
    await expect(
      renameConcept({ path: "/nope.md", newName: "x" }),
    ).rejects.toThrow();
  });

  it("does not move the file when the frontmatter title changes", async () => {
    const concept = await createConcept({ directory: "/", title: "Orders" });
    const updated = await updateConcept({
      path: concept.path,
      frontmatter: { type: "Concept", title: "Sales Orders" },
      body: "# Sales Orders",
    });
    expect(updated.path).toBe(concept.path);
    expect(updated.title).toBe("Sales Orders");
    await expect(readConcept({ path: concept.path })).resolves.toBeTruthy();
  });

  it("throws error when updating a concept that does not exist", async () => {
    await expect(
      updateConcept({
        path: "/ghost.md",
        frontmatter: { type: "Concept", title: "Ghost" },
        body: "# Ghost",
      }),
    ).rejects.toThrow();
  });
});

describe("parseConcept", () => {
  it("splits frontmatter and body", () => {
    const raw = `---\ntype: Concept\ntitle: Orders\n---\n\n# Orders\n\nBody text.\n`;
    const { frontmatter, body } = parseConcept({ raw });
    expect(frontmatter).toEqual({ type: "Concept", title: "Orders" });
    expect(body).toBe("# Orders\n\nBody text.\n");
  });

  it("handles a file with no frontmatter", () => {
    const { frontmatter, body } = parseConcept({ raw: "# Just a heading\n" });
    expect(frontmatter).toEqual({});
    expect(body).toBe("# Just a heading\n");
  });

  it("throws on invalid YAML", () => {
    const raw = `---\ntype: [unclosed\n---\nbody`;
    expect(() => parseConcept({ raw })).toThrow(UnparseableFrontmatterError);
  });
});

describe("serializeConcept round-trip", () => {
  it("preserves unknown keys and key order", () => {
    const fm = {
      type: "BigQuery Table",
      title: "Orders",
      owner: "data-platform",
      customField: "kept",
      tags: ["sales", "orders"],
    };
    const out = serializeConcept({
      frontmatter: fm,
      body: "# Orders\n\nText.",
    });
    const reparsed = parseConcept({ raw: out });
    expect(reparsed.frontmatter).toEqual(fm);
    expect(reparsed.body).toBe("# Orders\n\nText.\n");
    expect(out.indexOf("type:")).toBeLessThan(out.indexOf("title:"));
    expect(out.indexOf("owner:")).toBeLessThan(out.indexOf("customField:"));
  });

  it("is idempotent across a second round-trip", () => {
    const raw = `---\ntype: Concept\ntags:\n  - a\n  - b\n---\n\n# Title\n\nBody.\n`;
    const first = serializeConcept(parseConcept({ raw }));
    const second = serializeConcept(parseConcept({ raw: first }));
    expect(second).toBe(first);
  });

  it("emits no frontmatter block when frontmatter is empty", () => {
    expect(serializeConcept({ frontmatter: {}, body: "# Hi\n" })).toBe(
      "# Hi\n",
    );
  });
});

describe("reference propagation", () => {
  async function setBody(p: string, body: string): Promise<void> {
    const concept = await readConcept({ path: p });
    await updateConcept({ path: p, frontmatter: concept.frontmatter, body });
  }

  it("unwraps links to a concept that is deleted", async () => {
    const orders = await createConcept({ directory: "/", title: "Orders" });
    const ref = await createConcept({ directory: "/", title: "Ref" });
    await setBody(ref.path, `See [Orders](@${orders.path}).`);

    await deleteConcept({ path: orders.path });

    const reread = await readConcept({ path: ref.path });
    expect(reread.body).toContain("See Orders.");
    expect(reread.body).not.toContain(`](@${orders.path})`);
  });
});
