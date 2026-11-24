import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SetFlagRuleRequestSchema, type SetFlagRuleRequest } from '@app/contracts';
import { MemoryFlagsProvider } from '@app/api-core/flags/memory/memory-flags-provider';
import { createKit } from '../testing/workspace-kit';
import { FlagsAdminService } from './flags-admin.service';

const KEY = 'dashboard-whats-new';
const rule = (request: SetFlagRuleRequest) => SetFlagRuleRequestSchema.parse(request);

describe('FlagsAdminService', () => {
    beforeEach(() => {
        delete process.env.APP_ENVIRONMENT;
    });
    afterEach(() => {
        delete process.env.FLAGS_ADMIN_WORKSPACE_ID;
    });

    async function operator() {
        const kit = createKit();
        const { who, session } = await kit.register('ada', 'Acme');
        const workspaceId = session.workspace?.id as string;
        process.env.FLAGS_ADMIN_WORKSPACE_ID = workspaceId;
        return { kit, who, workspaceId, auth: await kit.auth(who, workspaceId) };
    }

    it('lists every declared flag, unconfigured until someone sets a rule', async () => {
        const { kit, workspaceId } = await operator();
        expect(await kit.flagsAdmin.list(workspaceId)).toEqual({
            provider: 'firestore',
            flags: [
                expect.objectContaining({
                    key: KEY,
                    type: 'boolean',
                    defaultValue: false,
                    rule: null,
                    updatedAt: null,
                    updatedBy: null,
                }),
            ],
        });
    });

    it('rolls a flag out: the team, then a percentage, then everyone, then off', async () => {
        const { kit, auth, workspaceId } = await operator();
        const { session: other } = await kit.register('bob', 'Other Co');
        const sessionOf = async (userId: string) =>
            (await kit.sessions.build({ ...auth, userId })).flags[KEY];
        expect(await sessionOf('ada')).toBe(false);

        const team = await kit.flagsAdmin.set(
            auth,
            workspaceId,
            KEY,
            rule({ value: true, allowList: { workspaceIds: [workspaceId] } }),
        );
        expect(team).toMatchObject({
            rule: { enabled: true, percent: 0, allowList: { workspaceIds: [workspaceId] } },
            updatedAt: '2026-01-01T00:00:00.000Z',
            updatedBy: 'ada',
        });
        expect(await sessionOf('ada')).toBe(true);
        expect(await sessionOf('bob')).toBe(false);

        await kit.flagsAdmin.set(auth, workspaceId, KEY, rule({ value: true, percent: 100 }));
        expect(await sessionOf('bob')).toBe(true);
        expect(other.flags[KEY]).toBe(false);

        await kit.flagsAdmin.turnOff(workspaceId, KEY);
        expect(await kit.flagsAdmin.read(workspaceId, KEY)).toMatchObject({ rule: null });
        expect(await sessionOf('ada')).toBe(false);
    });

    it('rejects a value that does not match the flag, and undeclared flags', async () => {
        const { kit, auth, workspaceId } = await operator();
        await expect(
            kit.flagsAdmin.set(auth, workspaceId, KEY, rule({ value: 'yes', percent: 100 })),
        ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
        await expect(kit.flagsAdmin.read(workspaceId, 'not-declared')).rejects.toMatchObject({
            code: 'NOT_FOUND',
        });
    });

    it('is operated only from the operator workspace, and `*` only locally', async () => {
        const { kit, workspaceId } = await operator();
        const { session } = await kit.register('bob', 'Customer');
        const customer = session.workspace?.id as string;
        await expect(kit.flagsAdmin.list(customer)).rejects.toMatchObject({ code: 'FORBIDDEN' });

        delete process.env.FLAGS_ADMIN_WORKSPACE_ID;
        await expect(kit.flagsAdmin.list(workspaceId)).rejects.toMatchObject({
            code: 'FORBIDDEN',
        });

        process.env.FLAGS_ADMIN_WORKSPACE_ID = '*';
        await expect(kit.flagsAdmin.list(customer)).resolves.toMatchObject({
            provider: 'firestore',
        });
        process.env.APP_ENVIRONMENT = 'prod';
        await expect(kit.flagsAdmin.list(customer)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('answers FLAGS_MANAGED_ELSEWHERE when another provider evaluates the flags', async () => {
        const { workspaceId } = await operator();
        const admin = new FlagsAdminService(new MemoryFlagsProvider());
        await expect(admin.list(workspaceId)).rejects.toMatchObject({
            code: 'FLAGS_MANAGED_ELSEWHERE',
        });
    });
});
