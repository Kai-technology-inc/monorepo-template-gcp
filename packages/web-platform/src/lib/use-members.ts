'use client';

import { apiRoutes, MemberListResponseSchema, type Member } from '@app/contracts';
import { callApi, useApiQuery } from '@app/web-kit';

/** The members of a workspace (`null` while loading), with a `reload` for after a change. */
export function useMembers(workspaceId: string | null): {
    readonly members: readonly Member[] | null;
    readonly error: unknown;
    readonly reload: () => void;
} {
    const path = workspaceId ? apiRoutes.workspaces.members(workspaceId) : null;
    const query = useApiQuery(path, async (signal) => {
        const response = await callApi(path as string, {
            schema: MemberListResponseSchema,
            signal,
        });
        return response.members;
    });
    return { members: query.data, error: query.error, reload: query.reload };
}
