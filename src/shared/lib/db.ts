export function rowToModel<T extends { createdAt: string; updatedAt: string }>(
  row: T,
): Omit<T, "createdAt" | "updatedAt"> & { createdAt: Date; updatedAt: Date } {
  return {
    ...row,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}
