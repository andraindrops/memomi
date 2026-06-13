import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export const IMAGE_URL_PREFIX = "app://uploads/";

let uploadsDir: string | null = null;

export function setUploadsDir(dir: string): void {
  uploadsDir = dir;
}

function getUploadsDir(): string {
  if (uploadsDir == null) {
    throw new Error(
      "Uploads directory has not been set. Call setUploadsDir() first.",
    );
  }
  return uploadsDir;
}

export async function saveImage({
  name,
  bytes,
}: {
  name: string;
  bytes: Uint8Array;
}): Promise<string> {
  const dir = getUploadsDir();
  await fs.mkdir(dir, { recursive: true });
  const fileName = `${randomUUID()}-${path.basename(name)}`;
  await fs.writeFile(path.join(dir, fileName), bytes);
  return `${IMAGE_URL_PREFIX}${fileName}`;
}

export async function deleteImage({ url }: { url: string }): Promise<void> {
  if (!url.startsWith(IMAGE_URL_PREFIX)) {
    return;
  }
  const fileName = path.basename(url.slice(IMAGE_URL_PREFIX.length));
  await fs.rm(path.join(getUploadsDir(), fileName), { force: true });
}
