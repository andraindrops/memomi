import { z } from "zod";

export interface BundleNodeSchema {
  name: string;
  path: string;
  kind: "directory" | "concept" | "index" | "log";
  children?: BundleNodeSchema[];
}

export const bundleNodeZodSchema: z.ZodType<BundleNodeSchema> = z.lazy(() =>
  z.object({
    name: z.string(),
    path: z.string(),
    kind: z.enum(["directory", "concept", "index", "log"]),
    children: z.array(bundleNodeZodSchema).optional(),
  }),
);

export const bundleZodSchema = z.object({
  root: z.string(),
  tree: bundleNodeZodSchema,
});

export type BundleSchema = z.infer<typeof bundleZodSchema>;
