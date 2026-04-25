import { z } from 'zod';

export const projectSchema = z.object({
  id: z.string(),
  name: z.string().min(2),
  description: z.string().optional(),
  createdAt: z.string()
});

export const documentSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  sourceType: z.enum(['TXT', 'PDF', 'DOCX', 'PASTE']),
  plainText: z.string(),
  createdAt: z.string()
});

export const codingSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  codeId: z.string(),
  snippet: z.string(),
  startIndex: z.number().int().nonnegative(),
  endIndex: z.number().int().nonnegative(),
  description: z.string().optional(),
  createdAt: z.string()
});

export type ProjectDto = z.infer<typeof projectSchema>;
export type DocumentDto = z.infer<typeof documentSchema>;
export type CodingDto = z.infer<typeof codingSchema>;
