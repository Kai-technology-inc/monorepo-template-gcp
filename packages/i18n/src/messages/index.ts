import type { Locale } from '@app/contracts';
import type { Messages } from '../types';

/**
 * THE DICTIONARIES, LOADED ONE AT A TIME
 *
 * Each locale is a dynamic import, so a page only ships the language it renders: the server layout loads the
 * dictionary and hands it to `<I18nProvider>`. Importing a dictionary file directly from a client component would
 * put it in that component's bundle; don't.
 */
const loaders: Readonly<Record<Locale, () => Promise<Messages>>> = {
    en: () => import('./en').then((module) => module.en),
    es: () => import('./es').then((module) => module.es),
    pt: () => import('./pt').then((module) => module.pt),
};

export function loadMessages(locale: Locale): Promise<Messages> {
    return loaders[locale]();
}

/** The base locale's dictionary: the fallback for any key missing at runtime. */
export function loadBaseMessages(): Promise<Messages> {
    return loaders.en();
}
