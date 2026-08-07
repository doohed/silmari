import { z } from 'zod';
import { FIELD_TYPES } from '@/lib/field-types';

const label = z.string().trim().min(1).max(80);
const identifier = z.string().trim().min(1).max(60);

const optionInput = z.object({
  id: z.string().optional(),
  label: z.string().min(1),
  value: z.string().min(1).optional(),
  color: z.string().optional(),
  position: z.number().optional(),
});

const relationInput = z.object({
  type: z.enum(['ONE_TO_MANY', 'MANY_TO_ONE', 'MANY_TO_MANY']),
  targetObjectMetadataId: z.string().min(1),
  targetFieldName: z.string().optional(),
  onDelete: z.enum(['CASCADE', 'SET_NULL', 'RESTRICT']).optional(),
});

export const createObjectSchema = z.object({
  nameSingular: identifier,
  namePlural: identifier.optional(),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, { error: 'El slug solo admite minúsculas, números y guiones' })
    .optional(),
  labelSingular: label,
  labelPlural: label.optional(),
  description: z.string().max(500).optional(),
  icon: z.string().optional(),
});

export const updateObjectSchema = z.object({
  labelSingular: label.optional(),
  labelPlural: label.optional(),
  description: z.string().max(500).optional(),
  icon: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const createFieldSchema = z.object({
  name: identifier,
  label,
  type: z.enum(FIELD_TYPES),
  description: z.string().max(500).optional(),
  icon: z.string().optional(),
  isNullable: z.boolean().optional(),
  isUnique: z.boolean().optional(),
  isIndexed: z.boolean().optional(),
  defaultValue: z.any().optional(),
  settings: z.record(z.string(), z.any()).optional(),
  options: z.array(optionInput).optional(),
  relation: relationInput.optional(),
});

export const updateFieldSchema = z.object({
  label: label.optional(),
  description: z.string().max(500).optional(),
  icon: z.string().optional(),
  isNullable: z.boolean().optional(),
  isIndexed: z.boolean().optional(),
  isActive: z.boolean().optional(),
  defaultValue: z.any().optional(),
  settings: z.record(z.string(), z.any()).optional(),
  options: z.array(optionInput).optional(),
  type: z.enum(FIELD_TYPES).optional(),
});
