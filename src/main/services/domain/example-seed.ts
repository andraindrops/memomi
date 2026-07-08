import { randomUUID } from "node:crypto";
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
      buildExampleConcepts().map((example) =>
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

// Concepts are stored as [uuid].md and display their frontmatter title, so the
// ids must be generated first: each example links to the next one by its uuid
// path, and the human-readable "Example N" only exists in frontmatter.
function buildExampleConcepts(): ExampleConcept[] {
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  return ids.map((id, i) => {
    const next = (i + 1) % ids.length;
    return {
      fileName: `${id}.md`,
      raw: exampleRaw({ n: i + 1, next: { n: next + 1, id: ids[next] } }),
    };
  });
}

function exampleRaw({
  n,
  next,
}: {
  n: number;
  next: { n: number; id: string };
}): string {
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

* [Example ${next.n}](@/${next.id}.md)
`;
}
