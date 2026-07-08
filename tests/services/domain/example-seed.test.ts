import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { seedExampleConcepts } from "@/main/services/domain/example-seed";

const UUID_MD =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.md$/;

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "okf-seed-"));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

function entries(): Promise<string[]> {
  return fs.readdir(root).then((e) => e.sort());
}

function mdEntries(): Promise<string[]> {
  return entries().then((e) => e.filter((name) => name.endsWith(".md")));
}

describe("seedExampleConcepts", () => {
  it("creates the example concepts as uuid-named files on an empty bundle", async () => {
    await seedExampleConcepts({ root });

    expect(await entries()).toContain(".seeded");
    const mdFiles = await mdEntries();
    expect(mdFiles).toHaveLength(3);
    for (const fileName of mdFiles) {
      expect(fileName).toMatch(UUID_MD);
    }
  });

  it("puts the display name in frontmatter and links examples by uuid path", async () => {
    await seedExampleConcepts({ root });

    const mdFiles = await mdEntries();
    const titles: string[] = [];
    for (const fileName of mdFiles) {
      const raw = await fs.readFile(path.join(root, fileName), "utf8");
      const title = raw.match(/^title: (.+)$/m)?.[1];
      if (title) titles.push(title);

      // Every page link must target another seeded uuid file, not the page
      // itself and not a leftover human-readable path. The body also shows the
      // `[label](@/path)` syntax as inline code, so only count .md targets.
      const links = [...raw.matchAll(/\]\(@\/([^)]+\.md)\)/g)].map((m) => m[1]);
      expect(links).toHaveLength(1);
      expect(links[0]).not.toBe(fileName);
      expect(mdFiles).toContain(links[0]);
    }
    expect(titles.sort()).toEqual(["Example 1", "Example 2", "Example 3"]);
  });

  it("does not regenerate examples the user deleted", async () => {
    await seedExampleConcepts({ root });
    for (const fileName of await mdEntries()) {
      await fs.rm(path.join(root, fileName));
    }

    await seedExampleConcepts({ root });

    expect(await entries()).toEqual([".seeded"]);
  });

  it("never clobbers an existing non-empty bundle", async () => {
    await fs.writeFile(path.join(root, "mine.md"), "# Mine");

    await seedExampleConcepts({ root });

    expect(await entries()).toEqual([".seeded", "mine.md"]);
  });
});
