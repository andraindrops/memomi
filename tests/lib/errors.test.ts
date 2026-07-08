import { describe, expect, it } from "vitest";
import {
  AppError,
  NotFoundError,
  BundleNotOpenError,
  PathTraversalError,
  UnparseableFrontmatterError,
  ValidationError,
} from "@/main/lib/errors";

describe("AppError", () => {
  it("is an Error with the given message and name", () => {
    const err = new AppError("boom");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("boom");
    expect(err.name).toBe("AppError");
  });
});

describe("AppError subclasses", () => {
  const cases = [
    { Cls: NotFoundError, name: "NotFoundError", def: "Not found" },
    {
      Cls: BundleNotOpenError,
      name: "BundleNotOpenError",
      def: "No bundle is open",
    },
    {
      Cls: PathTraversalError,
      name: "PathTraversalError",
      def: "Path escapes the bundle root",
    },
    {
      Cls: UnparseableFrontmatterError,
      name: "UnparseableFrontmatterError",
      def: "Frontmatter is not valid YAML",
    },
    { Cls: ValidationError, name: "ValidationError", def: "Validation failed" },
  ] as const;

  for (const { Cls, name, def } of cases) {
    describe(name, () => {
      it("extends AppError and Error", () => {
        const err = new Cls();
        expect(err).toBeInstanceOf(AppError);
        expect(err).toBeInstanceOf(Error);
      });

      it("sets its own name", () => {
        expect(new Cls().name).toBe(name);
      });

      it("uses a default message", () => {
        expect(new Cls().message).toBe(def);
      });

      it("accepts a custom message", () => {
        expect(new Cls("custom").message).toBe("custom");
      });

      it("is catchable as AppError", () => {
        expect(() => {
          throw new Cls();
        }).toThrow(AppError);
      });
    });
  }
});
