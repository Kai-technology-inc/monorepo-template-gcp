import { Injectable } from '@nestjs/common';
import { hasPermission, MemberSchema, type Member, type WorkspaceRole } from '@app/contracts';
import type { AuthContext } from '@app/api-core/auth/auth-context';
import { AppError, forbidden, notFound } from '@app/api-core/http/app-error';
import { MEMBERS_COLLECTION, paths } from '@app/api-core/persistence/paths';
import { parseDocument, Store, where, type Transaction } from '@app/api-core/persistence/store';
import { MemberRecordSchema, type MemberRecord } from '../records';

/**
 * THE RULES OF A WORKSPACE'S PEOPLE
 *
 * - Nobody changes their own role (`CANNOT_CHANGE_OWN_ROLE`): an owner who wants out promotes someone and leaves.
 * - Only an owner grants or takes away ownership (`FORBIDDEN`).
 * - A workspace never ends without an owner (`LAST_OWNER`), checked inside the same transaction as the write.
 * - Anyone can leave (remove themselves); removing someone else needs `members:manage`, and removing an owner needs
 *   to be an owner.
 */
@Injectable()
export class MembersService {
    constructor(private readonly store: Store) {}

    async list(workspaceId: string): Promise<Member[]> {
        const docs = await this.store.query(paths.members(workspaceId), [], {
            orderBy: { field: 'joinedAt', direction: 'asc' },
        });
        return docs.map((doc) => parseDocument(MemberSchema, doc.data, doc.path));
    }

    async changeRole(
        auth: AuthContext,
        workspaceId: string,
        userId: string,
        role: WorkspaceRole,
    ): Promise<Member> {
        if (userId === auth.userId) {
            throw new AppError('CANNOT_CHANGE_OWN_ROLE', 403, 'You cannot change your own role');
        }
        return this.store.runTransaction(async (tx) => {
            const target = await readMember(tx, workspaceId, userId);
            if ((role === 'OWNER' || target.role === 'OWNER') && auth.role !== 'OWNER') {
                throw forbidden('Only an owner can grant or revoke ownership');
            }
            if (target.role === 'OWNER' && role !== 'OWNER')
                await assertAnotherOwner(tx, workspaceId);
            const updated: MemberRecord = { ...target, role };
            tx.update(paths.member(workspaceId, userId), { role });
            return MemberSchema.parse(updated);
        });
    }

    /**
     * Removes a membership (or leaves, when `userId` is the caller). If it was the person's active workspace, their
     * active workspace moves to another membership, or to `null`.
     */
    async remove(auth: AuthContext, workspaceId: string, userId: string): Promise<void> {
        const self = userId === auth.userId;
        if (!self && !hasPermission(auth.role, 'members:manage')) {
            throw forbidden('Missing permission members:manage');
        }
        await this.store.runTransaction(async (tx) => {
            const target = await readMember(tx, workspaceId, userId);
            if (target.role === 'OWNER') {
                if (!self && auth.role !== 'OWNER')
                    throw forbidden('Only an owner can remove an owner');
                await assertAnotherOwner(tx, workspaceId);
            }
            const userPath = paths.user(userId);
            const user = await tx.get(userPath);
            const others = await tx.collectionGroup(MEMBERS_COLLECTION, [
                where('userId', '==', userId),
            ]);

            tx.delete(paths.member(workspaceId, userId));
            if (user && user.activeWorkspaceId === workspaceId) {
                const next = others
                    .map((doc) => parseDocument(MemberRecordSchema, doc.data, doc.path))
                    .filter((member) => member.workspaceId !== workspaceId)
                    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))[0];
                tx.update(userPath, { activeWorkspaceId: next?.workspaceId ?? null });
            }
        });
    }
}

async function readMember(
    tx: Transaction,
    workspaceId: string,
    userId: string,
): Promise<MemberRecord> {
    const path = paths.member(workspaceId, userId);
    const data = await tx.get(path);
    if (!data) throw notFound('Member not found');
    return parseDocument(MemberRecordSchema, data, path);
}

async function assertAnotherOwner(tx: Transaction, workspaceId: string): Promise<void> {
    const owners = await tx.query(paths.members(workspaceId), [where('role', '==', 'OWNER')], {
        limit: 2,
    });
    if (owners.length < 2)
        throw new AppError('LAST_OWNER', 409, 'A workspace needs at least one owner');
}
