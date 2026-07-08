import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { seedExampleConcepts } from "@/main/services/domain/example-seed";

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

describe("seedExampleConcepts", () => {
  it("creates the example concepts on an empty bundle", async () => {
    await seedExampleConcepts({ root });
    expect(await entries()).toEqual([
      ".seeded",
      "example-1.md",
      "example-2.md",
      "example-3.md",
    ]);
  });

  it("does not regenerate examples the user deleted", async () => {
    await seedExampleConcepts({ root });
    await fs.rm(path.join(root, "example-1.md"));
    await fs.rm(path.join(root, "example-2.md"));
    await fs.rm(path.join(root, "example-3.md"));

    await seedExampleConcepts({ root });

    expect(await entries()).toEqual([".seeded"]);
  });

  it("never clobbers an existing non-empty bundle", async () => {
    await fs.writeFile(path.join(root, "mine.md"), "# Mine");

    await seedExampleConcepts({ root });

    expect(await entries()).toEqual([".seeded", "mine.md"]);
  });
});
