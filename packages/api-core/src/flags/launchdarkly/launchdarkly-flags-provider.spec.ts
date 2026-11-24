import { describe, expect, it } from 'vitest';
import { basicLogger, init, type LDClient, type LDOptions } from '@launchdarkly/node-server-sdk';
import { TestData } from '@launchdarkly/node-server-sdk/integrations';
import type { FlagRule } from '@app/contracts';
import {
    CONTRACT_FLAGS,
    describeFlagsProviderContract,
    type ContractFlagKey,
} from '../../testing/flags-provider-contract';
import { LaunchDarklyFlagsProvider, launchDarklyContext } from './launchdarkly-flags-provider';

/**
 * LaunchDarkly, offline: the official SDK fed by its `TestData` integration, no account and no network.
 *
 * `launchDarklyFlag` is how a rule reads in LaunchDarkly's data model, i.e. what you set in its console:
 * - two variations, `[value, declared default]`; targeting off serves the second (`offVariation`);
 * - allow-list: individual targets on the `user` and `workspace` context kinds;
 * - percentage: the default rule as a percentage rollout by `user` (or `workspace`), weights in thousandths of a
 *   percent.
 */
function launchDarklyFlag(key: string, rule: FlagRule, defaultValue: unknown): object {
    const weight = Math.round(rule.percent * 1000);
    const { userIds, workspaceIds } = rule.allowList;
    return {
        key,
        version: 1,
        on: rule.enabled,
        salt: key,
        variations: [rule.value, defaultValue],
        offVariation: 1,
        targets: userIds.length ? [{ values: userIds, variation: 0 }] : [],
        contextTargets: [
            ...(userIds.length ? [{ contextKind: 'user', values: [], variation: 0 }] : []),
            ...(workspaceIds.length
                ? [{ contextKind: 'workspace', values: workspaceIds, variation: 0 }]
                : []),
        ],
        rules: [],
        fallthrough: {
            rollout: {
                contextKind: rule.bucketBy,
                variations: [
                    { variation: 0, weight },
                    { variation: 1, weight: 100_000 - weight },
                ],
            },
        },
        prerequisites: [],
        clientSide: false,
        trackEvents: false,
        trackEventsFallthrough: false,
        deleted: false,
    };
}

const clients: LDClient[] = [];
const OFFLINE: LDOptions = {
    sendEvents: false,
    diagnosticOptOut: true,
    logger: basicLogger({ level: 'none' }),
};

function testClient(updateProcessor: LDOptions['updateProcessor']): LDClient {
    const client = init('sdk-key-for-tests', { ...OFFLINE, updateProcessor });
    clients.push(client);
    return client;
}

describeFlagsProviderContract('launchdarkly', {
    withRules: async (rules, options) => {
        const td = new TestData();
        for (const [key, rule] of Object.entries(rules)) {
            await td.usePreconfiguredFlag(
                launchDarklyFlag(key, rule, CONTRACT_FLAGS[key as ContractFlagKey].defaultValue),
            );
        }
        return new LaunchDarklyFlagsProvider(testClient(td.getFactory()), options);
    },
    // A data source that never delivers: the client never initializes, as with LaunchDarkly unreachable.
    broken: (options) =>
        Promise.resolve(
            new LaunchDarklyFlagsProvider(
                testClient(() => ({
                    start: () => undefined,
                    stop: () => undefined,
                    close: () => undefined,
                })),
                options,
            ),
        ),
    close: () => {
        for (const client of clients) client.close();
        return Promise.resolve();
    },
});

describe('launchDarklyContext', () => {
    it('is a multi-context of the user and the workspace', () => {
        expect(
            launchDarklyContext({
                userId: 'ada',
                workspaceId: 'acme',
                attributes: { role: 'OWNER', key: 'ignored', kind: 'ignored' },
            }),
        ).toEqual({
            kind: 'multi',
            user: { key: 'ada', role: 'OWNER' },
            workspace: { key: 'acme' },
        });
    });

    it('is a user context when there is no workspace', () => {
        expect(launchDarklyContext({ userId: 'ada', workspaceId: null })).toEqual({
            kind: 'user',
            key: 'ada',
        });
    });
});
