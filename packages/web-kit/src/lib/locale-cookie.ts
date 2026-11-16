import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE_SECONDS, isLocale, type Locale } from '@app/i18n';

/** Reads the remembered language from `document.cookie`; `null` on the server or when unset. */
export function readLocaleCookie(
    cookieString: string | undefined = globalThis.document?.cookie,
): Locale | null {
    if (!cookieString) return null;
    for (const part of cookieString.split(';')) {
        const [name, ...rest] = part.trim().split('=');
        if (name === LOCALE_COOKIE) {
            const value = decodeURIComponent(rest.join('='));
            return isLocale(value) ? value : null;
        }
    }
    return null;
}

export function localeCookieString(locale: Locale): string {
    return `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

/** Remembers the language. The next server render (`router.refresh()`) picks it up. */
export function writeLocaleCookie(locale: Locale): void {
    document.cookie = localeCookieString(locale);
}
