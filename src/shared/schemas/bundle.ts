import { z } from "zod";

export interface BundleNodeSchema {
  name: string;
  path: string;
  title: string;
  kind: "directory" | "concept" | "index" | "log";
  children?: BundleNodeSchema[];
}

export const bundleNodeZodSchema: z.ZodType<BundleNodeSchema> = z.lazy(() =>
  z.object({
    name: z.string(),
    path: z.string(),
    title: z.string(),
    kind: z.enum(["directory", "concept", "index", "log"]),
    children: z.array(bundleNodeZodSchema).optional(),
  }),
);

export const bundleZodSchema = z.object({
  root: z.string(),
  tree: bundleNodeZodSchema,
});

export const reorderInputZodSchema = z.object({
  directory: z.string(),
  orderedNames: z.array(z.string()),
  movedPath: z.string().optional(),
});

export type BundleSchema = z.infer<typeof bundleZodSchema>;
export type ReorderInputSchema = z.infer<typeof reorderInputZodSchema>;
