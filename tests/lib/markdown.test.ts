import { describe, expect, it } from "vitest";
import { firstHeading, isMarkdownFile } from "@/main/lib/markdown";

describe("firstHeading", () => {
  it("returns the text of the first level-1 heading", () => {
    expect(firstHeading({ body: "# Orders\n\nbody" })).toBe("Orders");
  });

  it("trims surrounding whitespace from the heading text", () => {
    expect(firstHeading({ body: "#   Spaced Title   " })).toBe("Spaced Title");
  });

  it("finds a heading that is not on the first line", () => {
    expect(firstHeading({ body: "intro line\n\n# Real Title\n" })).toBe(
      "Real Title",
    );
  });

  it("returns the first heading when several are present", () => {
    expect(firstHeading({ body: "# First\n\n# Second" })).toBe("First");
  });

  it("ignores deeper headings (##, ###)", () => {
    expect(firstHeading({ body: "## Subsection\n\ntext" })).toBeUndefined();
  });

  it("ignores '#' without a following space", () => {
    expect(firstHeading({ body: "#NoSpace" })).toBeUndefined();
  });

  it("returns undefined when there is no heading", () => {
    expect(firstHeading({ body: "just some body text" })).toBeUndefined();
    expect(firstHeading({ body: "" })).toBeUndefined();
  });
});

describe("isMarkdownFile", () => {
  it("accepts .md files regardless of case", () => {
    expect(isMarkdownFile({ fileName: "notes.md" })).toBe(true);
    expect(isMarkdownFile({ fileName: "NOTES.MD" })).toBe(true);
    expect(isMarkdownFile({ fileName: "Read.Me.md" })).toBe(true);
  });

  it("rejects non-markdown extensions", () => {
    expect(isMarkdownFile({ fileName: "notes.txt" })).toBe(false);
    expect(isMarkdownFile({ fileName: "notes.markdown" })).toBe(false);
    expect(isMarkdownFile({ fileName: "md" })).toBe(false);
    expect(isMarkdownFile({ fileName: "" })).toBe(false);
  });
});
