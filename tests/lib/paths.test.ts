import { describe, expect, it } from "vitest";
import path from "node:path";
import {
  normalizeBundlePath,
  resolveSafe,
  toBundlePath,
  isInsideRoot,
} from "@/main/lib/paths";
import { PathTraversalError } from "@/main/lib/errors";

const ROOT = path.resolve("/tmp/okf-bundle");

describe("normalizeBundlePath", () => {
  it("adds a leading slash and strips redundant segments", () => {
    expect(normalizeBundlePath({ path: "domains/sales/orders.md" })).toBe(
      "/domains/sales/orders.md",
    );
    expect(normalizeBundlePath({ path: "/domains//sales/./orders.md" })).toBe(
      "/domains/sales/orders.md",
    );
    expect(normalizeBundlePath({ path: "" })).toBe("/");
  });

  it("rejects .. segments", () => {
    expect(() => normalizeBundlePath({ path: "../escape.md" })).toThrow(
      PathTraversalError,
    );
    expect(() => normalizeBundlePath({ path: "/a/../../b.md" })).toThrow(
      PathTraversalError,
    );
  });
});

describe("resolveSafe", () => {
  it("resolves bundle-relative paths under the root", () => {
    expect(resolveSafe({ root: ROOT, relPath: "/domains/orders.md" })).toBe(
      path.join(ROOT, "domains/orders.md"),
    );
    expect(resolveSafe({ root: ROOT, relPath: "orders.md" })).toBe(
      path.join(ROOT, "orders.md"),
    );
  });

  it("treats a leading-slash path as root-relative, not absolute", () => {
    expect(resolveSafe({ root: ROOT, relPath: "/etc/passwd" })).toBe(
      path.join(ROOT, "etc/passwd"),
    );
  });

  it("rejects traversal escapes", () => {
    expect(() =>
      resolveSafe({ root: ROOT, relPath: "../../etc/passwd" }),
    ).toThrow(PathTraversalError);
  });
});

describe("toBundlePath / isInsideRoot", () => {
  it("round-trips an absolute path within root", () => {
    const abs = path.join(ROOT, "domains/sales/orders.md");
    expect(toBundlePath({ root: ROOT, absPath: abs })).toBe(
      "/domains/sales/orders.md",
    );
    expect(toBundlePath({ root: ROOT, absPath: ROOT })).toBe("/");
  });

  it("flags paths outside the root", () => {
    expect(isInsideRoot({ root: ROOT, absPath: path.join(ROOT, "a.md") })).toBe(
      true,
    );
    expect(isInsideRoot({ root: ROOT, absPath: "/somewhere/else.md" })).toBe(
      false,
    );
    expect(() =>
      toBundlePath({ root: ROOT, absPath: "/somewhere/else.md" }),
    ).toThrow(PathTraversalError);
  });
});
