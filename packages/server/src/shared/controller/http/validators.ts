import { z } from "zod";

export const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export const uuidSchema = z.string().uuid();

export const uuidParamSchema = z.object({
  id: uuidSchema,
});

export type UuidParamInput = z.infer<typeof uuidParamSchema>;

export const migrationCheckpoint = {
  task: "Create shared validator helpers",
  status: "implemented-minimally",
} as const;
