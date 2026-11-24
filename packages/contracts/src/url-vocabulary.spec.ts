import { describe, expect, it } from 'vitest';
import { apiRoutes } from './api-routes';
import { invalidApiSegments } from './url-vocabulary';

describe('url vocabulary', () => {
    it('accepts kebab-case literals and camelCase params', () => {
        expect(invalidApiSegments('/account/active-workspace')).toEqual([]);
        expect(invalidApiSegments('/workspaces/:workspaceId/members/:userId')).toEqual([]);
    });

    it('rejects anything else', () => {
        expect(invalidApiSegments('/miembros_activos/:WorkspaceId/Members')).toEqual([
            'miembros_activos',
            ':WorkspaceId',
            'Members',
        ]);
    });

    it('every helper in apiRoutes builds a valid path', () => {
        const paths = [
            apiRoutes.account.register(),
            apiRoutes.account.session(),
            apiRoutes.account.profile(),
            apiRoutes.account.activeWorkspace(),
            apiRoutes.workspaces.members('w1'),
            apiRoutes.workspaces.acceptInvitation('w1', 'i1'),
            apiRoutes.workspaces.flags('w1'),
            apiRoutes.workspaces.flag('w1', 'dashboard-whats-new'),
        ];
        for (const path of paths) expect(invalidApiSegments(path)).toEqual([]);
    });
});
