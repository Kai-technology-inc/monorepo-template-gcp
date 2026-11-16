import type { PluralCategory, PluralMessage } from './types';

const PLACEHOLDER = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
const PLURAL_CATEGORIES: readonly PluralCategory[] = ['zero', 'one', 'two', 'few', 'many', 'other'];

export function isPluralMessage(value: unknown): value is PluralMessage {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const record = value as Record<string, unknown>;
    return (
        typeof record.other === 'string' &&
        Object.keys(record).every(
            (key) =>
                PLURAL_CATEGORIES.includes(key as PluralCategory) &&
                typeof record[key] === 'string',
        )
    );
}

const pluralRulesCache = new Map<string, Intl.PluralRules>();
const numberFormatCache = new Map<string, Intl.NumberFormat>();

function pluralRules(locale: string): Intl.PluralRules {
    let rules = pluralRulesCache.get(locale);
    if (!rules) {
        rules = new Intl.PluralRules(locale);
        pluralRulesCache.set(locale, rules);
    }
    return rules;
}

function numberFormat(locale: string): Intl.NumberFormat {
    let format = numberFormatCache.get(locale);
    if (!format) {
        format = new Intl.NumberFormat(locale);
        numberFormatCache.set(locale, format);
    }
    return format;
}

/**
 * Picks the plural form for `count` with the CLDR rules of the locale. An exact `zero` wins for 0 even in
 * languages whose rules never return `zero` (so "No members yet" can be written for English). A missing category
 * falls back to `other`.
 */
export function selectPlural(message: PluralMessage, count: number, locale: string): string {
    if (count === 0 && message.zero !== undefined) return message.zero;
    const category = pluralRules(locale).select(count) as PluralCategory;
    return message[category] ?? message.other;
}

/**
 * Replaces `{name}` with `params.name`. Numbers are formatted for the locale (`1234` → `1,234` / `1.234`).
 * A placeholder without a value is left as is, which is visible in the screen and in tests, instead of
 * silently printing "undefined".
 */
export function interpolate(
    template: string,
    params: Readonly<Record<string, string | number>> | undefined,
    locale: string,
): string {
    if (!params) return template;
    return template.replace(PLACEHOLDER, (match, name: string) => {
        const value = params[name];
        if (value === undefined) return match;
        return typeof value === 'number' ? numberFormat(locale).format(value) : value;
    });
}

/** The placeholder names of a template, for the parity check between locales. */
export function placeholdersOf(template: string): string[] {
    return [...template.matchAll(PLACEHOLDER)].map((match) => match[1] as string).sort();
}
