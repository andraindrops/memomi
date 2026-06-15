export function firstHeading({ body }: { body: string }): string | undefined {
  const m = /^#\s+(.+)$/m.exec(body);
  return m ? m[1].trim() : undefined;
}

export function isMarkdownFile({ fileName }: { fileName: string }): boolean {
  return fileName.toLowerCase().endsWith(".md");
}
