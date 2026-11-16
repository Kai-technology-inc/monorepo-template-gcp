import { z } from 'zod';

/**
 * The languages the product speaks. The web's dictionaries (`@app/i18n`) must cover exactly these, and the
 * API stores one of them per user so emails and server-rendered text follow the person, not the browser.
 *
 * To add a language: append it here, add `packages/i18n/src/messages/<locale>.ts`, and the parity spec tells
 * you which keys are missing.
 */
export const SUPPORTED_LOCALES = ['en', 'es', 'pt'] as const;
export const DEFAULT_LOCALE: Locale = 'en';

export const LocaleSchema = z.enum(SUPPORTED_LOCALES);
export type Locale = z.infer<typeof LocaleSchema>;

export function isLocale(value: unknown): value is Locale {
    return LocaleSchema.safeParse(value).success;
}

/**
 * The best supported locale for an `Accept-Language` header (or any list of BCP 47 tags), by quality and then by
 * order. A regional tag falls back to its language (`es-AR` → `es`). Unknown or empty input gives the default.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
    if (!acceptLanguage) return DEFAULT_LOCALE;
    const ranked = acceptLanguage
        .split(',')
        .map((part, index) => {
            const [tag, ...params] = part.trim().split(';');
            const q = params
                .map((p) => p.trim())
                .find((p) => p.startsWith('q='))
                ?.slice(2);
            const quality = q === undefined ? 1 : Number(q);
            return {
                tag: (tag ?? '').toLowerCase(),
                quality: Number.isNaN(quality) ? 0 : quality,
                index,
            };
        })
        .filter((entry) => entry.tag && entry.quality > 0)
        .sort((a, b) => b.quality - a.quality || a.index - b.index);
    for (const { tag } of ranked) {
        const language = tag.split('-')[0];
        if (isLocale(tag)) return tag;
        if (isLocale(language)) return language;
    }
    return DEFAULT_LOCALE;
}
