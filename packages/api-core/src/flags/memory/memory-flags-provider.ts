import type { FlagKey, FlagRule, FlagValue } from '@app/contracts';
import { FlagsProvider, type FlagContext, type FlagsProviderOptions } from '../flags-provider';
import { variationOf } from '../rule';

/**
 * FLAGS IN MEMORY, FOR TESTS
 *
 * The own provider's rules (`FlagRule`) kept in a map: what unit specs and test apps use, and what
 * `FLAGS_PROVIDER=memory` gives a running API (every flag at its default, nothing stored anywhere). It can be
 * broken on purpose to prove that callers get the declared default.
 */
export class MemoryFlagsProvider extends FlagsProvider {
    readonly name = 'memory';
    private readonly rules = new Map<string, FlagRule>();
    private failure: 'error' | 'hang' | null = null;

    constructor(options: FlagsProviderOptions = {}) {
        super(options);
    }

    /** Serves `rule` for `key`, with the same semantics as the Firestore provider. */
    setRule(key: string, rule: FlagRule): this {
        this.rules.set(key, structuredClone(rule));
        return this;
    }

    /** Everyone gets `value`. */
    set<K extends FlagKey>(key: K, value: FlagValue<K>): this {
        return this.setRule(key, {
            enabled: true,
            value: value as FlagRule['value'],
            percent: 100,
            bucketBy: 'user',
            allowList: { userIds: [], workspaceIds: [] },
        });
    }

    /** Back to the declared default: one flag, or all of them. */
    clear(key?: FlagKey): this {
        if (key) this.rules.delete(key);
        else this.rules.clear();
        return this;
    }

    /** Every evaluation from now on throws (`error`) or never answers (`hang`); `null` repairs it. */
    breakWith(failure: 'error' | 'hang' | null): this {
        this.failure = failure;
        return this;
    }

    protected variation(key: string, context: FlagContext): Promise<unknown> {
        if (this.failure === 'error') return Promise.reject(new Error('broken on purpose'));
        if (this.failure === 'hang') return new Promise(() => undefined);
        const rule = this.rules.get(key);
        return Promise.resolve(rule ? variationOf(key, rule, context) : undefined);
    }
}
