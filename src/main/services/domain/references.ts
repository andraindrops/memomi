import { promises as fs } from "node:fs";
import { walkMdFiles } from "@/main/lib/fs";
import { toBundlePath } from "@/main/lib/paths";

const LINK = /\[((?:[^\]\\]|\\.)*)\]\(@(\/[^)\s#]*)([^)]*)\)/g;

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
        const next = rebase({ dest, from, to });
        return next == null ? match : `[${label}](@${next}${tail})`;
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

function rebase({
  dest,
  from,
  to,
}: {
  dest: string;
  from: string;
  to: string;
}): string | null {
  if (dest === from) return to;
  if (dest.startsWith(`${from}/`)) return `${to}${dest.slice(from.length)}`;
  return null;
}

async function rewriteAll({
  root,
  rewrite,
}: {
  root: string;
  rewrite: (raw: string) => string;
}): Promise<string[]> {
  const files = await walkMdFiles({ absDir: root });
  const results = await Promise.all(
    files.map(async (abs) => {
      let raw: string;
      try {
        raw = await fs.readFile(abs, "utf8");
      } catch {
        return null;
      }
      const next = rewrite(raw);
      if (next === raw) return null;
      await fs.writeFile(abs, next, "utf8");
      return toBundlePath({ root, absPath: abs });
    }),
  );
  return results.filter((p): p is string => p != null);
}
