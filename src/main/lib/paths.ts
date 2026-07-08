import path from "node:path";
import { PathTraversalError } from "@/main/lib/errors";

export function normalizeBundlePath({
  path: rawPath,
}: {
  path: string;
}): string {
  const posix = rawPath.replace(/\\/g, "/");
  const segments = posix.split("/").filter((s) => s.length > 0 && s !== ".");
  if (segments.includes("..")) {
    throw new PathTraversalError(`Path "${rawPath}" contains ".."`);
  }
  return "/" + segments.join("/");
}

export function resolveSafe({
  root,
  relPath,
}: {
  root: string;
  relPath: string;
}): string {
  const normalized = normalizeBundlePath({ path: relPath });
  const rel = normalized.replace(/^\/+/, "");
  const abs = path.resolve(root, rel);
  const back = path.relative(root, abs);
  if (back === "") return abs;
  if (back.startsWith("..") || path.isAbsolute(back)) {
    throw new PathTraversalError(`Path "${relPath}" escapes the bundle root`);
  }
  return abs;
}

export function toBundlePath({
  root,
  absPath,
}: {
  root: string;
  absPath: string;
}): string {
  const rel = path.relative(root, absPath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new PathTraversalError(
      `Path "${absPath}" is outside the bundle root`,
    );
  }
  const posix = rel.split(path.sep).join("/");
  return posix === "" ? "/" : "/" + posix;
}

export function isInsideRoot({
  root,
  absPath,
}: {
  root: string;
  absPath: string;
}): boolean {
  const rel = path.relative(root, absPath);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export function assertSafeName({ name }: { name: string }): string {
  const trimmed = name.trim();
  if (
    trimmed === "" ||
    trimmed === "." ||
    trimmed === ".." ||
    trimmed.includes("/") ||
    trimmed.includes("\\")
  ) {
    throw new PathTraversalError(`Invalid name "${name}"`);
  }
  return trimmed;
}
