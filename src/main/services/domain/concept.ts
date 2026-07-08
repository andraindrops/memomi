import { randomUUID } from "node:crypto";
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
import { deleteLinks } from "@/main/services/domain/references";
import {
  normalizeBundlePath,
  resolveSafe,
  toBundlePath,
} from "@/main/lib/paths";
import { assertDoesNotExist, walkMdFiles } from "@/main/lib/fs";
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
  const results = await Promise.all(
    absFiles.map(async (abs): Promise<ConceptSummarySchema | null> => {
      const bundlePath = toBundlePath({ root, absPath: abs });
      try {
        const raw = await fs.readFile(abs, "utf8");
        const { frontmatter, body } = parseConcept({ raw });
        const fileName = path.posix.basename(bundlePath);
        return {
          id: bundlePath.replace(/\.md$/i, ""),
          path: bundlePath,
          title: deriveTitle({ frontmatter, body, fileName }),
          description: asString({ value: frontmatter.description }),
          type: asString({ value: frontmatter.type }) ?? "Concept",
        };
      } catch {
        return null;
      }
    }),
  );
  const summaries = results.filter((s): s is ConceptSummarySchema => s != null);
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
  title,
  type,
  description,
}: CreateConceptInputSchema): Promise<ConceptSchema> {
  const root = requireCurrentBundleRoot();
  const dirBundlePath = normalizeBundlePath({ path: directory });
  const fileName = `${randomUUID()}.md`;
  const bundlePath = normalizeBundlePath({
    path: path.posix.join(dirBundlePath, fileName),
  });
  const abs = resolveSafe({ root, relPath: bundlePath });

  await assertDoesNotExist({
    absPath: abs,
    message: `A file already exists at ${bundlePath}`,
  });

  const frontmatter = defaultFrontmatter({
    type: type ?? "Concept",
    title: title?.trim() || "Untitled",
    description: description ?? "",
  });
  const body = "Write content here.";
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

  const raw = serializeConcept({
    frontmatter: { ...frontmatter, timestamp: new Date().toISOString() },
    body,
  });
  await fs.writeFile(abs, raw, "utf8");
  return readConcept({ path: bundlePath });
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

  const title = newName.trim();
  if (title === "") throw new AppError("Name must not be empty");

  if (stat.isDirectory()) {
    await writeDirectoryTitle({ dirAbs: abs, title });
    return { path: bundlePath };
  }

  if (!isMarkdownFile({ fileName })) {
    throw new AppError(`${bundlePath} is not a Markdown concept`);
  }
  await updateConceptTitle({ path: bundlePath, title });
  return { path: bundlePath };
}

// A directory's display name lives in its index.md frontmatter, so renaming a
// directory rewrites (or creates) that file rather than touching the
// filesystem name.
async function writeDirectoryTitle({
  dirAbs,
  title,
}: {
  dirAbs: string;
  title: string;
}): Promise<void> {
  const indexAbs = path.join(dirAbs, "index.md");
  let frontmatter: FrontmatterSchema;
  let body: string;
  try {
    const raw = await fs.readFile(indexAbs, "utf8");
    ({ frontmatter, body } = parseConcept({ raw }));
  } catch {
    frontmatter = defaultFrontmatter({ type: "Index", title });
    body = INDEX_TEMPLATE_BODY;
  }
  const raw = serializeConcept({
    frontmatter: { ...frontmatter, title, timestamp: new Date().toISOString() },
    body,
  });
  await fs.writeFile(indexAbs, raw, "utf8");
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

export async function createConceptDirectory({
  parent,
  name,
}: CreateConceptDirectoryInputSchema): Promise<{ path: string }> {
  const root = requireCurrentBundleRoot();
  const parentBundlePath = normalizeBundlePath({ path: parent });
  const parentAbs = resolveSafe({ root, relPath: parentBundlePath });
  await fs.mkdir(parentAbs, { recursive: true });
  const title = name?.trim() || "Untitled";
  const bundlePath = normalizeBundlePath({
    path: path.posix.join(parentBundlePath, randomUUID()),
  });
  const abs = resolveSafe({ root, relPath: bundlePath });
  await fs.mkdir(abs, { recursive: true });
  await scaffoldDirectoryFiles({ dirAbs: abs, title });
  return { path: bundlePath };
}

async function scaffoldDirectoryFiles({
  dirAbs,
  title,
}: {
  dirAbs: string;
  title: string;
}): Promise<void> {
  await writeIfAbsent({
    abs: path.join(dirAbs, "index.md"),
    raw: serializeConcept({
      frontmatter: defaultFrontmatter({ type: "Index", title }),
      body: INDEX_TEMPLATE_BODY,
    }),
  });
  await writeIfAbsent({
    abs: path.join(dirAbs, "log.md"),
    raw: serializeConcept({
      frontmatter: defaultFrontmatter({ type: "Log", title: `${title} Log` }),
      body: LOG_TEMPLATE_BODY,
    }),
  });
}

async function writeIfAbsent({
  abs,
  raw,
}: {
  abs: string;
  raw: string;
}): Promise<void> {
  try {
    await fs.access(abs);
    return;
  } catch {
    /* empty */
  }
  await fs.writeFile(abs, raw, "utf8");
}

const INDEX_TEMPLATE_BODY = `# Section

* [Title 1](@/path/to/url-1) - short description of item 1
* [Title 2](@/path/to/url-2) - short description of item 2
* [Title 3](@/path/to/url-3) - short description of item 3`;

const LOG_TEMPLATE_BODY = `# Directory Update Log

## 2026-07-01
* **[Action example]**: [Title](@/path/to/url) - Message.
* **[Action example]**: [Title](@/path/to/url) - Message.
* **[Action example]**: [Title](@/path/to/url) - Message.`;

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

function defaultFrontmatter({
  type,
  title,
  description = "",
}: {
  type: string;
  title: string;
  description?: string;
}): FrontmatterSchema {
  return {
    type,
    title,
    description,
    resource: "",
    tags: [],
    timestamp: new Date().toISOString(),
  };
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

export function deriveTitle({
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
