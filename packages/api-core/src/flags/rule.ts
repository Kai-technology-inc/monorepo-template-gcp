import { createHash } from 'node:crypto';
import type { FlagRule } from '@app/contracts';
import type { FlagContext } from './flags-provider';

/**
 * Where an id falls for a flag, in [0, 100): a SHA-256 of `<flag key>:<id>`. The same id always lands in the same
 * place (a person does not flicker between variations), and each flag splits people differently (the same 10%
 * do not get every experiment).
 */
export function bucketOf(flagKey: string, id: string): number {
    const hash = createHash('sha256').update(`${flagKey}:${id}`).digest('hex');
    return (parseInt(hash.slice(0, 13), 16) / 16 ** 13) * 100;
}

/**
 * The own provider's semantics (`FlagRule` in @app/contracts): `rule.value` for whoever the rule targets,
 * `undefined` (the declared default) for everyone else. A bucket under `percent` gets the value, so raising the
 * percentage only adds people.
 */
export function variationOf(key: string, rule: FlagRule, context: FlagContext): unknown {
    if (!rule.enabled) return undefined;
    if (rule.allowList.userIds.includes(context.userId)) return rule.value;
    if (context.workspaceId && rule.allowList.workspaceIds.includes(context.workspaceId)) {
        return rule.value;
    }
    const id = rule.bucketBy === 'workspace' ? context.workspaceId : context.userId;
    if (id && bucketOf(key, id) < rule.percent) return rule.value;
    return undefined;
}
