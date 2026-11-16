import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@app/contracts';

export {
    DEFAULT_LOCALE,
    isLocale,
    negotiateLocale,
    SUPPORTED_LOCALES,
    type Locale,
} from '@app/contracts';

/**
 * Where the chosen language is remembered between visits, before and after signing in. The signed-in person's
 * profile (`users/{id}.locale`) wins over it: the web writes the cookie from the profile after sign-in, so the next
 * server render already speaks the right language.
 */
export const LOCALE_COOKIE = 'app-locale';
export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Each language's name, written in that language: what a language picker shows. */
export const LOCALE_NATIVE_NAMES: Readonly<Record<Locale, string>> = {
    en: 'English',
    es: 'Español',
    pt: 'Português',
};

/** Writing direction, for `<html dir>`. Add `ar`/`he` here as `rtl` when you support them. */
export function directionOf(_locale: Locale): 'ltr' | 'rtl' {
    return 'ltr';
}

export function allLocales(): readonly Locale[] {
    return SUPPORTED_LOCALES;
}

export function defaultLocale(): Locale {
    return DEFAULT_LOCALE;
}
