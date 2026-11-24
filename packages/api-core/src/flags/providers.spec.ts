import { describe, expect, it } from 'vitest';
import type { App } from 'firebase-admin/app';
import { InMemoryStore } from '../testing/in-memory-store';
import { systemClock } from '../time/clock';
import { FirestoreFlagsProvider } from './firestore/firestore-flags-provider';
import { MemoryFlagsProvider } from './memory/memory-flags-provider';
import { createFlagsProvider, FLAGS_ADAPTERS } from './providers';

describe('createFlagsProvider', () => {
    const deps = { store: new InMemoryStore(), app: {} as App, clock: systemClock };

    it('knows the four adapters', () => {
        expect(FLAGS_ADAPTERS).toEqual(['firestore', 'launchdarkly', 'remote-config', 'memory']);
    });

    it('builds the adapter it is asked for', async () => {
        expect(await createFlagsProvider('firestore', deps)).toBeInstanceOf(FirestoreFlagsProvider);
        expect(await createFlagsProvider('memory', deps)).toBeInstanceOf(MemoryFlagsProvider);
    });

    it('refuses an unknown adapter, and LaunchDarkly without its key', async () => {
        await expect(createFlagsProvider('unleash', deps)).rejects.toThrow(
            /FLAGS_PROVIDER=unleash/,
        );
        await expect(createFlagsProvider('toString', deps)).rejects.toThrow(/FLAGS_PROVIDER/);
        delete process.env.LAUNCHDARKLY_SDK_KEY;
        await expect(createFlagsProvider('launchdarkly', deps)).rejects.toThrow(
            /LAUNCHDARKLY_SDK_KEY/,
        );
    });
});
