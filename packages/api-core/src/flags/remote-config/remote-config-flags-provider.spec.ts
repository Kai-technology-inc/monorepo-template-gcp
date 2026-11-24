import { afterAll, describe, expect, it } from 'vitest';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getRemoteConfig } from 'firebase-admin/remote-config';
import {
    describeFlagsProviderContract,
    type ContractRules,
} from '../../testing/flags-provider-contract';
import {
    RemoteConfigFlagsProvider,
    remoteConfigParameter,
    remoteConfigSignals,
} from './remote-config-flags-provider';

/**
 * Remote Config, offline: the Admin SDK's server template initialized from JSON (what the console's "download
 * template" gives), so no project and no network.
 *
 * `remoteConfigTemplate` is how a rule reads in a server template, i.e. what you set in the console:
 * - a parameter per flag (`dashboard-whats-new` → `dashboard_whats_new`) whose default is "use in-app default";
 * - allow-list: a condition on the custom signals `userId` / `workspaceId` (exact match), first by priority;
 * - percentage: a percent condition (micro-percents, seeded with the parameter name); `randomizationId` is the
 *   user id, so Remote Config always splits by person;
 * - off: no conditional values.
 */
function remoteConfigTemplate(rules: ContractRules): string {
    const conditions: object[] = [];
    const parameters: Record<string, object> = {};
    for (const [key, rule] of Object.entries(rules)) {
        if (!rule) continue;
        const name = remoteConfigParameter(key);
        const value = {
            value: typeof rule.value === 'string' ? rule.value : JSON.stringify(rule.value),
        };
        const conditionalValues: Record<string, object> = {};
        const { userIds, workspaceIds } = rule.allowList;
        if (rule.enabled && (userIds.length || workspaceIds.length)) {
            const signal = (customSignalKey: string, targets: string[]) => ({
                customSignal: {
                    customSignalKey,
                    customSignalOperator: 'STRING_EXACTLY_MATCHES',
                    targetCustomSignalValues: targets,
                },
            });
            conditions.push({
                name: `${name}_allow_list`,
                condition: {
                    orCondition: {
                        conditions: [
                            ...(userIds.length ? [signal('userId', userIds)] : []),
                            ...(workspaceIds.length ? [signal('workspaceId', workspaceIds)] : []),
                        ],
                    },
                },
            });
            conditionalValues[`${name}_allow_list`] = value;
        }
        if (rule.enabled && rule.percent > 0) {
            conditions.push({
                name: `${name}_rollout`,
                condition: {
                    percent: {
                        percentOperator: 'LESS_OR_EQUAL',
                        microPercent: Math.round(rule.percent * 1_000_000),
                        seed: name,
                    },
                },
            });
            conditionalValues[`${name}_rollout`] = value;
        }
        parameters[name] = { defaultValue: { useInAppDefault: true }, conditionalValues };
    }
    return JSON.stringify({ conditions, parameters, etag: 'etag-spec' });
}

const app = initializeApp({ projectId: 'demo-flags-spec' }, 'remote-config-spec');

describeFlagsProviderContract('remote-config', {
    withRules: (rules, options) =>
        Promise.resolve(
            RemoteConfigFlagsProvider.fromTemplate(app, remoteConfigTemplate(rules), options),
        ),
    // A template that cannot load (Remote Config unreachable, or no permission).
    broken: (options) =>
        Promise.resolve(
            new RemoteConfigFlagsProvider(
                getRemoteConfig(app).initServerTemplate(),
                () => Promise.reject(new Error('UNAVAILABLE')),
                options,
            ),
        ),
});

afterAll(() => deleteApp(app));

describe('RemoteConfigFlagsProvider', () => {
    it('names parameters with underscores', () => {
        expect(remoteConfigParameter('dashboard-whats-new')).toBe('dashboard_whats_new');
    });

    it('splits by user and passes the context as custom signals', () => {
        expect(
            remoteConfigSignals({
                userId: 'ada',
                workspaceId: 'acme',
                attributes: { role: 'OWNER', seats: 3, beta: true, userId: 'ignored' },
            }),
        ).toEqual({
            randomizationId: 'ada',
            userId: 'ada',
            workspaceId: 'acme',
            role: 'OWNER',
            seats: 3,
            beta: 'true',
        });
    });

    it('retries the first load until it succeeds, then serves the template', async () => {
        const template = getRemoteConfig(app).initServerTemplate();
        let attempts = 0;
        const provider = new RemoteConfigFlagsProvider(
            template,
            () => {
                attempts += 1;
                if (attempts === 1) return Promise.reject(new Error('UNAVAILABLE'));
                template.set(
                    JSON.stringify({
                        conditions: [],
                        parameters: { dashboard_whats_new: { defaultValue: { value: 'true' } } },
                        etag: 'e2',
                    }),
                );
                return Promise.resolve();
            },
            { logger: { warn: () => undefined, error: () => undefined } },
        );
        const context = { userId: 'ada', workspaceId: null };
        expect(await provider.evaluate('dashboard-whats-new', context)).toBe(false);
        expect(await provider.evaluate('dashboard-whats-new', context)).toBe(true);
        expect(attempts).toBe(2);
    });
});
