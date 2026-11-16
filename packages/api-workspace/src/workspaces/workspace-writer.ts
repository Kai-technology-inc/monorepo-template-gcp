import { slugify, WorkspaceSlugSchema, type Workspace } from '@app/contracts';
import { AppError } from '@app/api-core/http/app-error';
import { paths } from '@app/api-core/persistence/paths';
import type { Transaction } from '@app/api-core/persistence/store';
import type { MemberRecord } from '../records';

const MAX_SLUG_ATTEMPTS = 20;

/**
 * Finds a free slug inside a transaction (reads only). An explicit slug must be free (`SLUG_TAKEN`); a derived one
 * gets `-2`, `-3`… until one is, trimming the base so the result stays within 40 characters.
 */
export async function allocateSlug(
    tx: Transaction,
    name: string,
    explicit: string | undefined,
    randomSuffix: () => string,
): Promise<string> {
    if (explicit) {
        if (await tx.get(paths.workspaceSlug(explicit))) {
            throw new AppError('SLUG_TAKEN', 409, `The slug "${explicit}" is taken`);
        }
        return explicit;
    }
    const base = slugify(name);
    for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt += 1) {
        const candidate = withSuffix(base, attempt === 1 ? '' : String(attempt));
        if (!(await tx.get(paths.workspaceSlug(candidate)))) return candidate;
    }
    return withSuffix(base, randomSuffix());
}

function withSuffix(base: string, suffix: string): string {
    if (!suffix) return base;
    const trimmed = base.slice(0, 40 - suffix.length - 1).replace(/-+$/, '');
    const slug = `${trimmed}-${suffix}`;
    return WorkspaceSlugSchema.parse(slug);
}

/**
 * Writes a new workspace with its owner: the workspace, its slug reservation and the owner's membership. The caller
 * has done its reads (including `allocateSlug`) and decides what else to write (the owner's active workspace).
 */
export function writeWorkspace(
    tx: Transaction,
    input: {
        readonly workspaceId: string;
        readonly name: string;
        readonly slug: string;
        readonly owner: {
            readonly userId: string;
            readonly email: string;
            readonly displayName: string;
        };
        readonly now: string;
    },
): Workspace {
    const workspace: Workspace = {
        id: input.workspaceId,
        name: input.name,
        slug: input.slug,
        ownerId: input.owner.userId,
        createdAt: input.now,
        updatedAt: input.now,
    };
    const member: MemberRecord = {
        userId: input.owner.userId,
        workspaceId: input.workspaceId,
        email: input.owner.email,
        displayName: input.owner.displayName,
        role: 'OWNER',
        joinedAt: input.now,
    };
    tx.create(paths.workspace(workspace.id), { ...workspace });
    tx.create(paths.workspaceSlug(workspace.slug), { workspaceId: workspace.id });
    tx.create(paths.member(workspace.id, input.owner.userId), { ...member });
    return workspace;
}
