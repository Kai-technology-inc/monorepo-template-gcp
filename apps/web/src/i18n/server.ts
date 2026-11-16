import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import {
    createFormatters,
    createTranslator,
    isLocale,
    LOCALE_COOKIE,
    negotiateLocale,
    type Formatters,
    type Locale,
    type Messages,
    type Translate,
} from '@app/i18n';
import { loadMessages } from '@app/i18n/messages';

/**
 * THE LANGUAGE OF A REQUEST
 *
 * The cookie wins (it is what the person chose, or what their profile says: the session writes it after sign-in);
 * otherwise the browser's `Accept-Language`; otherwise the default. Cached per request, so the layout and every
 * server component agree without reading headers twice.
 */
export const getLocale = cache(async (): Promise<Locale> => {
    const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
    if (isLocale(cookie)) return cookie;
    return negotiateLocale((await headers()).get('accept-language'));
});

export const getMessages = cache(async (): Promise<Messages> => loadMessages(await getLocale()));

/** `t` and the formatters for server components: `const { t } = await getI18n();`. */
export const getI18n = cache(
    async (): Promise<{ locale: Locale; messages: Messages; t: Translate; format: Formatters }> => {
        const locale = await getLocale();
        const messages = await getMessages();
        return {
            locale,
            messages,
            t: createTranslator(locale, messages),
            format: createFormatters(locale),
        };
    },
);
