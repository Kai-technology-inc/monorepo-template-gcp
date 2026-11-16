import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from './primitives';

export const WorkspaceNameSchema = z.string().trim().min(2).max(60);

/** Lowercase letters, digits and single hyphens; it is what a workspace is called in URLs. */
export const WorkspaceSlugSchema = z
    .string()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens');

/** `workspaces/{workspaceId}`: a tenant. Every piece of product data lives under one. */
export const WorkspaceSchema = z.object({
    id: IdSchema,
    name: WorkspaceNameSchema,
    slug: WorkspaceSlugSchema,
    ownerId: IdSchema,
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const CreateWorkspaceRequestSchema = z.strictObject({
    name: WorkspaceNameSchema,
    slug: WorkspaceSlugSchema.optional(),
});
export type CreateWorkspaceRequest = z.infer<typeof CreateWorkspaceRequestSchema>;

export const UpdateWorkspaceRequestSchema = z.strictObject({ name: WorkspaceNameSchema });
export type UpdateWorkspaceRequest = z.infer<typeof UpdateWorkspaceRequestSchema>;

/** A slug proposal from a name: `"Acme Inc."` → `"acme-inc"`. The API makes it unique. */
export function slugify(name: string): string {
    const slug = name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40)
        .replace(/-+$/g, '');
    return slug.length >= 3
        ? slug
        : `${slug || 'workspace'}-${'x'.repeat(Math.max(0, 3 - slug.length))}`.slice(0, 40);
}
