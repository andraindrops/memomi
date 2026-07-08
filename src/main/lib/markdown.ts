export function firstHeading({ body }: { body: string }): string | undefined {
  const headingMatch = /^#\s+(.+)$/m.exec(body);
  if (headingMatch == null) return undefined;
  return headingMatch[1].trim();
}

export function isMarkdownFile({ fileName }: { fileName: string }): boolean {
  return fileName.toLowerCase().endsWith(".md");
}
