import { describe, expect, it } from "vitest";
import { cn } from "@/renderer/lib/utils";

describe("cn", () => {
  it("joins multiple class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });

  it("resolves conditional object syntax", () => {
    expect(cn("base", { active: true, hidden: false })).toBe("base active");
  });

  it("merges conflicting tailwind classes, keeping the last", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-sm text-lg")).toBe("text-lg");
  });

  it("returns an empty string with no meaningful input", () => {
    expect(cn()).toBe("");
    expect(cn(false, null, undefined)).toBe("");
  });
});
