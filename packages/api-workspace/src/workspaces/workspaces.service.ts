import { Inject, Injectable } from '@nestjs/common';
import {
    WorkspaceSchema,
    type CreateWorkspaceRequest,
    type Session,
    type UpdateWorkspaceRequest,
    type Workspace,
} from '@app/contracts';
import type { AuthContext } from '@app/api-core/auth/auth-context';
import { notFound } from '@app/api-core/http/app-error';
import { paths } from '@app/api-core/persistence/paths';
import { parseDocument, Store } from '@app/api-core/persistence/store';
import { CLOCK, type Clock } from '@app/api-core/time/clock';
import { SessionService } from '../session/session.service';
import { allocateSlug, writeWorkspace } from './workspace-writer';

@Injectable()
export class WorkspacesService {
    constructor(
        private readonly store: Store,
        private readonly sessions: SessionService,
        @Inject(CLOCK) private readonly clock: Clock,
    ) {}

    /** Creates a workspace owned by the caller and switches them to it. */
    async create(auth: AuthContext, request: CreateWorkspaceRequest): Promise<Session> {
        const now = this.clock.now().toISOString();
        await this.store.runTransaction(async (tx) => {
            const slug = await allocateSlug(tx, request.name, request.slug, () =>
                this.store.newId().slice(0, 6).toLowerCase(),
            );
            const workspace = writeWorkspace(tx, {
                workspaceId: this.store.newId(),
                name: request.name,
                slug,
                owner: {
                    userId: auth.userId,
                    email: auth.email,
                    displayName: auth.user.displayName,
                },
                now,
            });
            tx.update(paths.user(auth.userId), { activeWorkspaceId: workspace.id, updatedAt: now });
        });
        return this.sessions.build(auth);
    }

    async update(workspaceId: string, request: UpdateWorkspaceRequest): Promise<Workspace> {
        const path = paths.workspace(workspaceId);
        return this.store.runTransaction(async (tx) => {
            const data = await tx.get(path);
            if (!data) throw notFound('Workspace not found');
            const updated: Workspace = {
                ...parseDocument(WorkspaceSchema, data, path),
                name: request.name,
                updatedAt: this.clock.now().toISOString(),
            };
            tx.update(path, { name: updated.name, updatedAt: updated.updatedAt });
            return updated;
        });
    }
}
