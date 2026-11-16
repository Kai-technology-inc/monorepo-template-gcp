/**
 * `@app/i18n`: the runtime-agnostic core. Safe to import from server and client code; it does not include any
 * dictionary. Load dictionaries with `@app/i18n/messages` (server) and render with `@app/i18n/react` (client).
 */
export { createFormatters, type Formatters } from './formatters';
export { interpolate, isPluralMessage, placeholdersOf, selectPlural } from './format';
export * from './locale-config';
export { createTranslator, lookup, type TranslatorOptions } from './translator';
export type {
    MessageKey,
    Messages,
    ParamsOf,
    PluralCategory,
    PluralMessage,
    Translate,
    TranslateArgs,
} from './types';
