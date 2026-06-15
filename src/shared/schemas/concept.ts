import { z } from "zod";

export const frontmatterZodSchema = z.record(z.string(), z.unknown());

export const conceptZodSchema = z.object({
  id: z.string(),
  path: z.string(),
  fileName: z.string(),
  directory: z.string(),
  frontmatter: frontmatterZodSchema,
  title: z.string(),
  description: z.string().optional(),
  type: z.string(),
  tags: z.array(z.string()),
  body: z.string(),
  isIndex: z.boolean(),
  isLog: z.boolean(),
  updatedAt: z.string().optional(),
});

export const conceptSummaryZodSchema = z.object({
  id: z.string(),
  path: z.string(),
  title: z.string(),
  description: z.string().optional(),
  type: z.string(),
});

export const readConceptInputZodSchema = z.object({
  path: z.string(),
});

export const updateConceptInputZodSchema = z.object({
  path: z.string(),
  frontmatter: frontmatterZodSchema,
  body: z.string(),
});

export const createConceptInputZodSchema = z.object({
  directory: z.string(),
  fileName: z.string().min(1).optional(),
  title: z.string().optional(),
  type: z.string().optional(),
  description: z.string().optional(),
});

export const deleteConceptInputZodSchema = z.object({
  path: z.string(),
});

export const createConceptDirectoryInputZodSchema = z.object({
  parent: z.string(),
  name: z.string().min(1).optional(),
});

export const renameConceptInputZodSchema = z.object({
  path: z.string(),
  newName: z.string().min(1),
});

export type FrontmatterSchema = z.infer<typeof frontmatterZodSchema>;
export type ConceptSchema = z.infer<typeof conceptZodSchema>;
export type ConceptSummarySchema = z.infer<typeof conceptSummaryZodSchema>;
export type ReadConceptInputSchema = z.infer<typeof readConceptInputZodSchema>;
export type UpdateConceptInputSchema = z.infer<
  typeof updateConceptInputZodSchema
>;
export type CreateConceptInputSchema = z.infer<
  typeof createConceptInputZodSchema
>;
export type DeleteConceptInputSchema = z.infer<
  typeof deleteConceptInputZodSchema
>;
export type CreateConceptDirectoryInputSchema = z.infer<
  typeof createConceptDirectoryInputZodSchema
>;
export type RenameConceptInputSchema = z.infer<
  typeof renameConceptInputZodSchema
>;
