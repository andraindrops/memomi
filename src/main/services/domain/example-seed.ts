import { promises as fs } from "node:fs";
import path from "node:path";
import { isMarkdownFile } from "@/main/lib/markdown";

// Marker dropped in the bundle root after the one-time seeding runs. It is a
// dotfile, so buildTree/walkMdFiles ignore it and it never shows in the tree.
// Its presence — not the example files themselves — is what suppresses
// re-seeding, so deleting the examples does not bring them back.
const SEED_MARKER = ".seeded";

interface ExampleConcept {
  fileName: string;
  raw: string;
}

export async function seedExampleConcepts({
  root,
}: {
  root: string;
}): Promise<void> {
  if (await hasSeeded({ root })) return;

  // Only lay down the examples on a genuinely empty bundle so we never clobber
  // content an existing user already has. Either way we drop the marker so this
  // never runs again.
  if (!(await hasMarkdownFiles({ absDir: root }))) {
    await Promise.all(
      EXAMPLE_CONCEPTS.map((example) =>
        fs.writeFile(path.join(root, example.fileName), example.raw, "utf8"),
      ),
    );
  }

  await fs.writeFile(path.join(root, SEED_MARKER), "", "utf8");
}

async function hasSeeded({ root }: { root: string }): Promise<boolean> {
  try {
    await fs.access(path.join(root, SEED_MARKER));
    return true;
  } catch {
    return false;
  }
}

async function hasMarkdownFiles({
  absDir,
}: {
  absDir: string;
}): Promise<boolean> {
  let entries: string[];
  try {
    entries = await fs.readdir(absDir);
  } catch {
    return false;
  }
  return entries.some((name) => isMarkdownFile({ fileName: name }));
}

const EXAMPLE_CONCEPTS: ExampleConcept[] = [
  { fileName: "example-1.md", raw: exampleRaw({ n: 1, next: 2 }) },
  { fileName: "example-2.md", raw: exampleRaw({ n: 2, next: 3 }) },
  { fileName: "example-3.md", raw: exampleRaw({ n: 3, next: 1 }) },
];

function exampleRaw({ n, next }: { n: number; next: number }): string {
  return `---
type: Concept
title: Example ${n}
description: "A sample concept page created on first launch."
resource: ""
tags: []
---

# Example ${n}

Welcome to OKF. This is a sample page added the first time you opened the
app. Feel free to edit or delete it — it will not be regenerated.

## Page links

Link to another page with the \`[label](@/path)\` syntax. Click it to navigate
in the app:

* [Example ${next}](@/example-${next}.md)
`;
}
