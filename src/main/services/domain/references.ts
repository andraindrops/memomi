import { promises as fs } from "node:fs";
import { walkMdFiles } from "@/main/lib/fs";
import { toBundlePath } from "@/main/lib/paths";

const LINK = /\[((?:[^\]\\]|\\.)*)\]\((\/[^)\s#]*)([^)]*)\)/g;

export async function updateLinks({
  root,
  from,
  to,
}: {
  root: string;
  from: string;
  to: string;
}): Promise<string[]> {
  return rewriteAll({
    root,
    rewrite: (raw) =>
      raw.replace(LINK, (match, label: string, dest: string, tail: string) => {
        const next =
          dest === from
            ? to
            : dest.startsWith(`${from}/`)
              ? `${to}${dest.slice(from.length)}`
              : null;
        return next == null ? match : `[${label}](${next}${tail})`;
      }),
  });
}

export async function deleteLinks({
  root,
  target,
}: {
  root: string;
  target: string;
}): Promise<string[]> {
  return rewriteAll({
    root,
    rewrite: (raw) =>
      raw.replace(LINK, (match, label: string, dest: string) =>
        dest === target || dest.startsWith(`${target}/`) ? label : match,
      ),
  });
}

async function rewriteAll({
  root,
  rewrite,
}: {
  root: string;
  rewrite: (raw: string) => string;
}): Promise<string[]> {
  const files = await walkMdFiles({ absDir: root });
  const changed: string[] = [];
  for (const abs of files) {
    let raw: string;
    try {
      raw = await fs.readFile(abs, "utf8");
    } catch {
      continue;
    }
    const next = rewrite(raw);
    if (next === raw) continue;
    await fs.writeFile(abs, next, "utf8");
    changed.push(toBundlePath({ root, absPath: abs }));
  }
  return changed;
}
