import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { dump as dumpYaml } from "js-yaml";
import type {
  ConceptSchema,
  ConceptSummarySchema,
  CreateConceptInputSchema,
  CreateConceptDirectoryInputSchema,
  FrontmatterSchema,
  RenameConceptInputSchema,
} from "@/shared/schemas/concept";
import { requireCurrentBundleRoot } from "@/main/services/domain/bundle";
import { deleteLinks, updateLinks } from "@/main/services/domain/references";
import {
  assertSafeName,
  normalizeBundlePath,
  resolveSafe,
  toBundlePath,
} from "@/main/lib/paths";
import { nextUntitledName, walkMdFiles } from "@/main/lib/fs";
import { readOrder, writeOrder } from "@/main/lib/order";
import { firstHeading, isMarkdownFile } from "@/main/lib/markdown";
import { asString } from "@/main/lib/value";
import {
  AppError,
  NotFoundError,
  UnparseableFrontmatterError,
} from "@/main/lib/errors";

export interface ParsedConcept {
  frontmatter: FrontmatterSchema;
  body: string;
}

export async function listConcepts(): Promise<ConceptSummarySchema[]> {
  const root = requireCurrentBundleRoot();
  const absFiles = await walkMdFiles({ absDir: root });
  const summaries: ConceptSummarySchema[] = [];
  for (const abs of absFiles) {
    const bundlePath = toBundlePath({ root, absPath: abs });
    try {
      const raw = await fs.readFile(abs, "utf8");
      const { frontmatter, body } = parseConcept({ raw });
      const fileName = path.posix.basename(bundlePath);
      summaries.push({
        id: bundlePath.replace(/\.md$/i, ""),
        path: bundlePath,
        title: deriveTitle({ frontmatter, body, fileName }),
        description: asString({ value: frontmatter.description }),
        type: asString({ value: frontmatter.type }) ?? "Concept",
      });
    } catch {
      continue;
    }
  }
  summaries.sort((a, b) => a.path.localeCompare(b.path));
  return summaries;
}

export async function readConcept({
  path: p,
}: {
  path: string;
}): Promise<ConceptSchema> {
  const root = requireCurrentBundleRoot();
  const bundlePath = normalizeBundlePath({ path: p });
  const abs = resolveSafe({ root, relPath: bundlePath });
  let raw: string;
  let mtime: Date | undefined;
  try {
    raw = await fs.readFile(abs, "utf8");
    mtime = (await fs.stat(abs)).mtime;
  } catch {
    throw new NotFoundError(`Concept ${bundlePath} not found`);
  }
  return toConcept({ bundlePath, raw, mtime });
}

export async function createConcept({
  directory,
  fileName,
  title,
  type,
  description,
}: CreateConceptInputSchema): Promise<ConceptSchema> {
  const root = requireCurrentBundleRoot();
  const dirBundlePath = normalizeBundlePath({ path: directory });
  const dirAbs = resolveSafe({ root, relPath: dirBundlePath });
  if (fileName != null) assertSafeName({ name: fileName });
  const finalFileName =
    fileName == null
      ? await nextUntitledName({ absDir: dirAbs, ext: ".md" })
      : isMarkdownFile({ fileName })
        ? fileName
        : `${fileName}.md`;
  const bundlePath = normalizeBundlePath({
    path: path.posix.join(dirBundlePath, finalFileName),
  });
  const abs = resolveSafe({ root, relPath: bundlePath });

  await assertConceptAvailable({ root, bundlePath });

  const finalTitle = title ?? finalFileName.replace(/\.md$/i, "");
  const frontmatter: FrontmatterSchema = {
    type: type ?? "Concept",
    title: finalTitle,
    description: description ?? "",
    tags: [],
  };
  const body = `# ${finalTitle}\n\nWrite content here.`;
  const raw = serializeConcept({ frontmatter, body });

  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, raw, "utf8");
  return readConcept({ path: bundlePath });
}

export async function updateConcept({
  path: p,
  frontmatter,
  body,
}: {
  path: string;
  frontmatter: FrontmatterSchema;
  body: string;
}): Promise<ConceptSchema> {
  const root = requireCurrentBundleRoot();
  const bundlePath = normalizeBundlePath({ path: p });
  const abs = resolveSafe({ root, relPath: bundlePath });

  try {
    await fs.stat(abs);
  } catch {
    throw new NotFoundError(`Concept ${bundlePath} not found`);
  }

  const newBundlePath = await planTitleRename({
    root,
    bundlePath,
    frontmatter,
  });

  const raw = serializeConcept({ frontmatter, body });
  await fs.writeFile(abs, raw, "utf8");

  if (newBundlePath == null) return readConcept({ path: bundlePath });
  await moveConceptFile({
    root,
    bundlePath,
    finalName: path.posix.basename(newBundlePath),
  });
  return readConcept({ path: newBundlePath });
}

export async function deleteConcept({
  path: p,
}: {
  path: string;
}): Promise<void> {
  const root = requireCurrentBundleRoot();
  const bundlePath = normalizeBundlePath({ path: p });
  const abs = resolveSafe({ root, relPath: bundlePath });

  let stat;
  try {
    stat = await fs.stat(abs);
  } catch {
    throw new NotFoundError(`${bundlePath} not found`);
  }

  await fs.rm(abs, { recursive: stat.isDirectory(), force: false });
  await deleteLinks({ root, target: bundlePath });
}

export async function renameConcept({
  path: p,
  newName,
}: RenameConceptInputSchema): Promise<{ path: string }> {
  const root = requireCurrentBundleRoot();
  const bundlePath = normalizeBundlePath({ path: p });
  const abs = resolveSafe({ root, relPath: bundlePath });
  const fileName = path.posix.basename(bundlePath);

  let stat;
  try {
    stat = await fs.stat(abs);
  } catch {
    throw new NotFoundError(`${bundlePath} not found`);
  }

  if (
    stat.isFile() &&
    isMarkdownFile({ fileName }) &&
    !isStructuralFile({ fileName })
  ) {
    const updated = await updateConceptTitle({
      path: bundlePath,
      title: newName,
    });
    return { path: updated.path };
  }

  let finalName = assertSafeName({ name: newName });
  if (stat.isFile() && isMarkdownFile({ fileName })) {
    finalName = isMarkdownFile({ fileName: finalName })
      ? finalName
      : `${finalName}.md`;
  }
  const newBundlePath = await moveConceptFile({ root, bundlePath, finalName });
  return { path: newBundlePath };
}

async function updateConceptTitle({
  path: p,
  title,
}: {
  path: string;
  title: string;
}): Promise<ConceptSchema> {
  const root = requireCurrentBundleRoot();
  const bundlePath = normalizeBundlePath({ path: p });
  const abs = resolveSafe({ root, relPath: bundlePath });
  const trimmed = title.trim();
  if (trimmed === "") throw new AppError("Title must not be empty");

  let raw: string;
  try {
    raw = await fs.readFile(abs, "utf8");
  } catch {
    throw new NotFoundError(`Concept ${bundlePath} not found`);
  }
  const { frontmatter, body } = parseConcept({ raw });
  return updateConcept({
    path: bundlePath,
    frontmatter: { ...frontmatter, title: trimmed },
    body,
  });
}

async function moveConceptFile({
  root,
  bundlePath,
  finalName,
}: {
  root: string;
  bundlePath: string;
  finalName: string;
}): Promise<string> {
  const abs = resolveSafe({ root, relPath: bundlePath });
  const parent = path.posix.dirname(bundlePath);
  const newBundlePath = normalizeBundlePath({
    path: path.posix.join(parent, finalName),
  });
  if (newBundlePath === bundlePath) return bundlePath;

  await assertConceptAvailable({ root, bundlePath: newBundlePath });

  const newAbs = resolveSafe({ root, relPath: newBundlePath });
  await fs.rename(abs, newAbs);
  await preserveOrderOnRename({
    parentAbs: path.dirname(abs),
    oldName: path.basename(abs),
    newName: finalName,
  });
  await updateLinks({ root, from: bundlePath, to: newBundlePath });
  return newBundlePath;
}

// Keep a renamed entry in its current position by swapping its name in the
// parent directory's order manifest, if one exists.
async function preserveOrderOnRename({
  parentAbs,
  oldName,
  newName,
}: {
  parentAbs: string;
  oldName: string;
  newName: string;
}): Promise<void> {
  const order = await readOrder({ absDir: parentAbs });
  const index = order.indexOf(oldName);
  if (index === -1) return;
  order[index] = newName;
  await writeOrder({ absDir: parentAbs, order });
}

async function assertConceptAvailable({
  root,
  bundlePath,
}: {
  root: string;
  bundlePath: string;
}): Promise<void> {
  const abs = resolveSafe({ root, relPath: bundlePath });
  try {
    await fs.access(abs);
  } catch {
    return;
  }
  throw new AppError(`A file already exists at ${bundlePath}`);
}

export async function createConceptDirectory({
  parent,
  name,
}: CreateConceptDirectoryInputSchema): Promise<{ path: string }> {
  const root = requireCurrentBundleRoot();
  const parentBundlePath = normalizeBundlePath({ path: parent });
  const parentAbs = resolveSafe({ root, relPath: parentBundlePath });
  await fs.mkdir(parentAbs, { recursive: true });
  if (name != null) assertSafeName({ name });
  const finalName =
    name ?? (await nextUntitledName({ absDir: parentAbs, ext: "" }));
  const bundlePath = normalizeBundlePath({
    path: path.posix.join(parentBundlePath, finalName),
  });
  const abs = resolveSafe({ root, relPath: bundlePath });
  await fs.mkdir(abs, { recursive: true });
  return { path: bundlePath };
}

export function parseConcept({ raw }: { raw: string }): ParsedConcept {
  try {
    const parsed = matter(raw);
    const frontmatter = (parsed.data ?? {}) as FrontmatterSchema;
    return { frontmatter, body: parsed.content.replace(/^\n/, "") };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new UnparseableFrontmatterError(`Invalid frontmatter: ${detail}`);
  }
}

export function serializeConcept({ frontmatter, body }: ParsedConcept): string {
  const trimmedBody = body.replace(/^\s*\n/, "").replace(/\s+$/, "");
  const hasFrontmatter = Object.keys(frontmatter ?? {}).length > 0;

  if (!hasFrontmatter) {
    return trimmedBody.length === 0 ? "" : `${trimmedBody}\n`;
  }

  const yamlStr = dumpYaml(frontmatter, {
    sortKeys: false,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });

  if (trimmedBody.length === 0) {
    return `---\n${yamlStr}---\n`;
  }
  return `---\n${yamlStr}---\n\n${trimmedBody}\n`;
}

function toConcept({
  bundlePath,
  raw,
  mtime,
}: {
  bundlePath: string;
  raw: string;
  mtime?: Date;
}): ConceptSchema {
  const fileName = path.posix.basename(bundlePath);
  const directory = path.posix.dirname(bundlePath);
  const { frontmatter, body } = parseConcept({ raw });
  return {
    id: bundlePath.replace(/\.md$/i, ""),
    path: bundlePath,
    fileName,
    directory,
    frontmatter,
    title: deriveTitle({ frontmatter, body, fileName }),
    description: asString({ value: frontmatter.description }),
    type: asString({ value: frontmatter.type }) ?? "Concept",
    tags: deriveTags({ frontmatter }),
    body,
    isIndex: fileName === "index.md",
    isLog: fileName === "log.md",
    updatedAt: mtime?.toISOString(),
  };
}

async function planTitleRename({
  root,
  bundlePath,
  frontmatter,
}: {
  root: string;
  bundlePath: string;
  frontmatter: FrontmatterSchema;
}): Promise<string | null> {
  const fileName = path.posix.basename(bundlePath);
  if (!isMarkdownFile({ fileName }) || isStructuralFile({ fileName })) {
    return null;
  }
  const title = asString({ value: frontmatter.title });
  if (title == null) return null;
  const base = titleToFileName({ title });
  if (base == null) return null;
  const finalName = `${base}.md`;
  if (finalName === fileName) return null;

  const parent = path.posix.dirname(bundlePath);
  const newBundlePath = normalizeBundlePath({
    path: path.posix.join(parent, finalName),
  });
  await assertConceptAvailable({ root, bundlePath: newBundlePath });
  return newBundlePath;
}

function titleToFileName({ title }: { title: string }): string | null {
  const cleaned = title
    .replace(/[/\\]/g, "-")
    .trim()
    .replace(/^\.+/, "")
    .trim();
  if (cleaned === "" || cleaned === "." || cleaned === "..") return null;
  return cleaned;
}

function isStructuralFile({ fileName }: { fileName: string }): boolean {
  return fileName === "index.md" || fileName === "log.md";
}

function deriveTitle({
  frontmatter,
  body,
  fileName,
}: {
  frontmatter: FrontmatterSchema;
  body: string;
  fileName: string;
}): string {
  return (
    asString({ value: frontmatter.title }) ??
    firstHeading({ body }) ??
    fileName.replace(/\.md$/i, "")
  );
}

function deriveTags({
  frontmatter,
}: {
  frontmatter: FrontmatterSchema;
}): string[] {
  const raw = frontmatter.tags;
  if (Array.isArray(raw)) {
    return raw.filter((t): t is string => typeof t === "string");
  }
  return [];
}
