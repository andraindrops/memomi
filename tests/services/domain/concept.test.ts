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

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "okf-test-"));
  setCurrentBundle({ root });
});

afterEach(async () => {
  setCurrentBundle({ root: null });
  await fs.rm(root, { recursive: true, force: true });
});

describe("concept service", () => {
  it("creates a concept with default frontmatter and reads it back", async () => {
    const concept = await createConcept({
      directory: "/domains/sales",
      fileName: "orders",
      title: "Orders",
    });
    expect(concept.path).toBe("/domains/sales/orders.md");
    expect(concept.type).toBe("Concept");
    expect(concept.title).toBe("Orders");

    const onDisk = await fs.readFile(
      path.join(root, "domains/sales/orders.md"),
      "utf8",
    );
    expect(onDisk).toContain("type:");
    expect(onDisk).toContain("# Orders");
  });

  it("preserves unknown frontmatter keys across a write", async () => {
    await createConcept({ directory: "/", fileName: "a" });
    const concept = await readConcept({ path: "/a.md" });
    const updated = await updateConcept({
      path: "/a.md",
      frontmatter: { ...concept.frontmatter, customKey: "value" },
      body: "# A\n\nUpdated.",
    });
    expect(updated.frontmatter.customKey).toBe("value");

    const reread = await readConcept({ path: "/a.md" });
    expect(reread.frontmatter.customKey).toBe("value");
    expect(reread.body).toBe("# A\n\nUpdated.\n");
  });

  it("lists concepts as summaries", async () => {
    await createConcept({ directory: "/", fileName: "a", title: "Alpha" });
    await createConcept({ directory: "/sub", fileName: "b", title: "Beta" });
    const list = await listConcepts();
    const paths = list.map((c) => c.path);
    expect(paths).toContain("/a.md");
    expect(paths).toContain("/sub/b.md");
  });

  it("deletes a concept", async () => {
    await createConcept({ directory: "/", fileName: "x" });
    await deleteConcept({ path: "/x.md" });
    await expect(readConcept({ path: "/x.md" })).rejects.toThrow();
  });

  it("deletes a directory and its contents recursively", async () => {
    await createConceptDirectory({ parent: "/", name: "sub" });
    await createConcept({ directory: "/sub", fileName: "nested" });
    await deleteConcept({ path: "/sub" });
    await expect(readConcept({ path: "/sub/nested.md" })).rejects.toThrow();
    expect(await listConcepts()).toHaveLength(0);
  });

  it("throws when deleting a missing entry", async () => {
    await expect(deleteConcept({ path: "/nope.md" })).rejects.toThrow();
  });

  it("auto-assigns Untitled-N names for concepts without a fileName", async () => {
    const first = await createConcept({ directory: "/" });
    const second = await createConcept({ directory: "/" });
    expect(first.path).toBe("/Untitled-0.md");
    expect(second.path).toBe("/Untitled-1.md");
  });

  it("skips taken Untitled-N slots", async () => {
    await createConcept({ directory: "/", fileName: "Untitled-0" });
    const next = await createConcept({ directory: "/" });
    expect(next.path).toBe("/Untitled-1.md");
  });

  it("auto-assigns Untitled-N names for folders without a name", async () => {
    const first = await createConceptDirectory({ parent: "/" });
    const second = await createConceptDirectory({ parent: "/" });
    expect(first.path).toBe("/Untitled-0");
    expect(second.path).toBe("/Untitled-1");
  });

  it("renames a concept, preserving the .md extension", async () => {
    await createConcept({ directory: "/", fileName: "Untitled-0" });
    const { path: renamed } = await renameConcept({
      path: "/Untitled-0.md",
      newName: "orders",
    });
    expect(renamed).toBe("/orders.md");
    await expect(readConcept({ path: "/orders.md" })).resolves.toBeTruthy();
    await expect(readConcept({ path: "/Untitled-0.md" })).rejects.toThrow();
  });

  it("renames a folder and its contents move with it", async () => {
    await createConcept({ directory: "/Untitled-0", fileName: "a" });
    const { path: renamed } = await renameConcept({
      path: "/Untitled-0",
      newName: "tables",
    });
    expect(renamed).toBe("/tables");
    await expect(readConcept({ path: "/tables/a.md" })).resolves.toBeTruthy();
  });

  it("rejects creating a concept onto an existing file", async () => {
    await createConcept({ directory: "/", fileName: "a" });
    await expect(
      createConcept({ directory: "/", fileName: "a" }),
    ).rejects.toThrow();
  });

  it("rejects a rename onto an existing file", async () => {
    await createConcept({ directory: "/", fileName: "a" });
    await createConcept({ directory: "/", fileName: "b" });
    await expect(
      renameConcept({ path: "/a.md", newName: "b" }),
    ).rejects.toThrow();
  });

  it("rejects a rename with a path separator", async () => {
    await createConcept({ directory: "/", fileName: "a" });
    await expect(
      renameConcept({ path: "/a.md", newName: "sub/b" }),
    ).rejects.toThrow();
  });

  it("throws error when creating a concept with a path separator", async () => {
    await expect(
      createConcept({ directory: "/", fileName: "sub/escape" }),
    ).rejects.toThrow();
  });

  it("throws error when creating a directory with a path separator", async () => {
    await expect(
      createConceptDirectory({ parent: "/", name: "sub/escape" }),
    ).rejects.toThrow();
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

  it("rewrites links in other concepts when a file is renamed", async () => {
    await createConcept({ directory: "/", fileName: "orders" });
    await createConcept({ directory: "/", fileName: "ref" });
    await setBody("/ref.md", "See [Orders](/orders.md).");

    await renameConcept({ path: "/orders.md", newName: "sales-orders" });

    const ref = await readConcept({ path: "/ref.md" });
    expect(ref.body).toContain("[Orders](/sales-orders.md)");
  });

  it("unwraps links to a concept that is deleted", async () => {
    await createConcept({ directory: "/", fileName: "orders" });
    await createConcept({ directory: "/", fileName: "ref" });
    await setBody("/ref.md", "See [Orders](/orders.md).");

    await deleteConcept({ path: "/orders.md" });

    const ref = await readConcept({ path: "/ref.md" });
    expect(ref.body).toContain("See Orders.");
    expect(ref.body).not.toContain("](/orders.md)");
  });
});
