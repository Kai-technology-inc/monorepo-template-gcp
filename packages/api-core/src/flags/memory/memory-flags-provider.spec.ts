import { describe, expect, it } from 'vitest';
import { describeFlagsProviderContract } from '../../testing/flags-provider-contract';
import { MemoryFlagsProvider } from './memory-flags-provider';

describeFlagsProviderContract('memory', {
    withRules: (rules, options) => {
        const provider = new MemoryFlagsProvider(options);
        for (const [key, rule] of Object.entries(rules)) provider.setRule(key, rule);
        return Promise.resolve(provider);
    },
    broken: (options) => Promise.resolve(new MemoryFlagsProvider(options).breakWith('error')),
});

describe('MemoryFlagsProvider', () => {
    const quiet = { warn: () => undefined, error: () => undefined };

    it('serves the default when the provider never answers, after the timeout', async () => {
        const provider = new MemoryFlagsProvider({ timeoutMs: 20, logger: quiet }).breakWith(
            'hang',
        );
        const started = Date.now();
        await expect(
            provider.evaluate('dashboard-whats-new', { userId: 'ada', workspaceId: null }),
        ).resolves.toBe(false);
        expect(Date.now() - started).toBeLessThan(1000);
    });

    it('sets a value for everyone and clears it', async () => {
        const provider = new MemoryFlagsProvider({ logger: quiet }).set(
            'dashboard-whats-new',
            true,
        );
        const context = { userId: 'ada', workspaceId: null };
        expect(await provider.evaluate('dashboard-whats-new', context)).toBe(true);
        provider.clear();
        expect(await provider.evaluate('dashboard-whats-new', context)).toBe(false);
    });
});
