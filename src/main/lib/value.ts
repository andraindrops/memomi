export function asString({ value }: { value: unknown }): string | undefined {
  return typeof value === "string" ? value : undefined;
}
