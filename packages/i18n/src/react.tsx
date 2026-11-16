'use client';

import { createContext, Fragment, useContext, useMemo, type ReactNode } from 'react';
import type { Locale } from '@app/contracts';
import { createFormatters, type Formatters } from './formatters';
import { createTranslator } from './translator';
import type { MessageKey, Messages, Translate, TranslateArgs } from './types';

/**
 * THE REACT BINDINGS
 *
 * The server layout resolves the locale (cookie → profile → `Accept-Language`), loads its dictionary and renders
 * `<I18nProvider locale messages>`. Every client component under it reads text with `useT()`:
 *
 *     const t = useT();
 *     <h1>{t('auth.login.title')}</h1>
 *     <p>{t('members.count', { count: members.length })}</p>
 *
 * and dates/numbers with `useFormatters()`. Server components use `getI18n()` from the web app, which builds the
 * same translator.
 */
interface I18nContextValue {
    readonly locale: Locale;
    readonly t: Translate;
    readonly format: Formatters;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export interface I18nProviderProps {
    readonly locale: Locale;
    readonly messages: Messages;
    readonly timeZone?: string;
    readonly children: ReactNode;
}

export function I18nProvider({
    locale,
    messages,
    timeZone,
    children,
}: I18nProviderProps): ReactNode {
    const value = useMemo<I18nContextValue>(
        () => ({
            locale,
            t: createTranslator(locale, messages, {
                onMissingKey: (key) => {
                    if (process.env.NODE_ENV !== 'production') {
                        console.warn(`[i18n] Missing "${key}" in "${locale}"`);
                    }
                },
            }),
            format: createFormatters(locale, timeZone),
        }),
        [locale, messages, timeZone],
    );
    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
    const value = useContext(I18nContext);
    if (!value) throw new Error('useI18n() must be used inside <I18nProvider>');
    return value;
}

export function useT(): Translate {
    return useI18n().t;
}

export function useLocale(): Locale {
    return useI18n().locale;
}

export function useFormatters(): Formatters {
    return useI18n().format;
}

const TAG = /<([a-zA-Z][a-zA-Z0-9]*)>(.*?)<\/\1>/g;

/**
 * Renders a message that contains markup tags, mapping each tag to a component:
 *
 *     // "Don't have an account? <link>Create one</link>"
 *     <RichText k="auth.login.noAccount" tags={{ link: (chunk) => <Link href="/auth/register">{chunk}</Link> }} />
 *
 * Tags are not nested and carry no attributes: the attributes (the href, the class) belong to the code, the words
 * belong to the dictionary. A tag without a renderer prints its inner text.
 */
export function RichText<K extends MessageKey>({
    k,
    params,
    tags,
}: {
    readonly k: K;
    readonly params?: TranslateArgs<K>[0];
    readonly tags: Readonly<Record<string, (chunk: string) => ReactNode>>;
}): ReactNode {
    const t = useT();
    const text = (t as (key: string, params?: unknown) => string)(k, params);
    return <>{renderTags(text, tags)}</>;
}

export function renderTags(
    text: string,
    tags: Readonly<Record<string, (chunk: string) => ReactNode>>,
): ReactNode[] {
    const nodes: ReactNode[] = [];
    let last = 0;
    for (const match of text.matchAll(TAG)) {
        const [whole, name, inner] = match as unknown as [string, string, string];
        const index = match.index ?? 0;
        if (index > last) nodes.push(text.slice(last, index));
        const render = tags[name];
        nodes.push(<Fragment key={`${name}-${index}`}>{render ? render(inner) : inner}</Fragment>);
        last = index + whole.length;
    }
    if (last < text.length) nodes.push(text.slice(last));
    return nodes;
}
