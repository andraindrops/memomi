import { BundleNotOpenError } from "@/main/lib/errors";

let bundleRoot: string | null = null;

export function setBundleRoot({ dir }: { dir: string | null }): void {
  bundleRoot = dir;
}

export function getBundleRoot(): string | null {
  return bundleRoot;
}

export function requireBundleRoot(): string {
  if (bundleRoot == null) {
    throw new BundleNotOpenError();
  }
  return bundleRoot;
}
