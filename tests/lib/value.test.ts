import { describe, expect, it } from "vitest";
import { asString } from "@/main/lib/value";

describe("asString", () => {
  it("returns the value unchanged when it is a string", () => {
    expect(asString({ value: "hello" })).toBe("hello");
    expect(asString({ value: "" })).toBe("");
  });

  it("returns undefined for non-string values", () => {
    expect(asString({ value: 42 })).toBeUndefined();
    expect(asString({ value: true })).toBeUndefined();
    expect(asString({ value: null })).toBeUndefined();
    expect(asString({ value: undefined })).toBeUndefined();
    expect(asString({ value: {} })).toBeUndefined();
    expect(asString({ value: ["a"] })).toBeUndefined();
  });
});
