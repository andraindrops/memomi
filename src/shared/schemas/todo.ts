import { z } from "zod";

export const todoSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable(),
  imageUrl: z.string().nullable(),
  createdUserId: z.string(),
  updatedUserId: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createTodoSchema = z.object({
  title: todoSchema.shape.title,
  description: todoSchema.shape.description.optional(),
  imageUrl: todoSchema.shape.imageUrl.optional(),
});

export const updateTodoSchema = z.object({
  title: todoSchema.shape.title,
  description: todoSchema.shape.description.optional(),
  imageUrl: todoSchema.shape.imageUrl.optional(),
});

export const todoFormSchema = z.object({
  title: todoSchema.shape.title,
  description: z.string().max(2000),
});

export type Todo = z.infer<typeof todoSchema>;
export type CreateTodoInput = z.infer<typeof createTodoSchema>;
export type UpdateTodoInput = z.infer<typeof updateTodoSchema>;
export type TodoFormValues = z.infer<typeof todoFormSchema>;
