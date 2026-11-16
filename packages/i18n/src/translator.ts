import type { Locale } from '@app/contracts';
import { interpolate, isPluralMessage, selectPlural } from './format';
import type { MessageKey, Messages, PluralMessage, Translate } from './types';

export interface TranslatorOptions {
    /** Used when a key is missing in `messages` (only possible with untyped, runtime-loaded dictionaries). */
    readonly fallback?: Messages;
    /** Called once per missing key, e.g. to log it. Defaults to nothing. */
    readonly onMissingKey?: (key: string, locale: Locale) => void;
}

export function lookup(messages: unknown, key: string): string | PluralMessage | undefined {
    let node: unknown = messages;
    for (const part of key.split('.')) {
        if (typeof node !== 'object' || node === null) return undefined;
        node = (node as Record<string, unknown>)[part];
    }
    if (typeof node === 'string' || isPluralMessage(node)) return node;
    return undefined;
}

/**
 * `t(key, params)` for one locale. Keys and params are type-checked against the base dictionary; at runtime a
 * missing key falls back to `options.fallback` and, as a last resort, to the key itself, so a gap is visible and
 * never crashes a screen.
 */
export function createTranslator(
    locale: Locale,
    messages: Messages,
    options: TranslatorOptions = {},
): Translate {
    const reported = new Set<string>();
    const translate = (key: MessageKey, params?: Record<string, string | number>): string => {
        let message = lookup(messages, key);
        if (message === undefined) {
            if (!reported.has(key)) {
                reported.add(key);
                options.onMissingKey?.(key, locale);
            }
            message = options.fallback ? lookup(options.fallback, key) : undefined;
        }
        if (message === undefined) return key;
        if (typeof message === 'string') return interpolate(message, params, locale);
        const count = typeof params?.count === 'number' ? params.count : Number(params?.count ?? 0);
        return interpolate(selectPlural(message, count, locale), params, locale);
    };
    return translate as Translate;
}
