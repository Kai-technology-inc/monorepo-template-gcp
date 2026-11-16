/**
 * THE SHAPE OF A DICTIONARY, DERIVED FROM THE BASE ONE
 *
 * `messages/en.ts` is the source of truth and is written `as const`, so its literal strings are known to the
 * compiler. From it we derive:
 *
 * - `MessageKey`: every leaf, as a dotted path (`'auth.login.title'`). `t('auth.login.tilte')` does not compile.
 * - `Messages`: the shape any other locale must have: the same tree, any string at each leaf. A missing or extra
 *   key in `es.ts` does not compile either.
 * - `ParamsOf<K>`: the `{placeholders}` of a key, so `t('members.count', { count: 3 })` is checked too.
 *
 * A leaf is either a string or a plural: an object with an `other` form and any of the CLDR categories
 * (`zero`, `one`, `two`, `few`, `many`). Which forms a language needs is the language's business: English uses
 * `one`/`other`, Polish adds `few`/`many`. That is why the plural forms are not checked key by key against the
 * base locale. Because `other` marks a plural, never name a namespace key `other`.
 */
import type { en } from './messages/en';

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
export type PluralMessage = Partial<Record<Exclude<PluralCategory, 'other'>, string>> & {
    other: string;
};

type BaseMessages = typeof en;

/** The same tree as the base, with any string at each leaf. */
export type MessagesOf<T> = {
    readonly [K in keyof T]: T[K] extends string
        ? string
        : T[K] extends { other: string }
          ? PluralMessage
          : MessagesOf<T[K]>;
};
export type Messages = MessagesOf<BaseMessages>;

type Join<P extends string, K extends string> = P extends '' ? K : `${P}.${K}`;

type LeafPaths<T, P extends string = ''> = {
    [K in keyof T & string]: T[K] extends string
        ? Join<P, K>
        : T[K] extends { other: string }
          ? Join<P, K>
          : LeafPaths<T[K], Join<P, K>>;
}[keyof T & string];

export type MessageKey = LeafPaths<BaseMessages>;

type LeafAt<T, Path extends string> = Path extends `${infer Head}.${infer Rest}`
    ? Head extends keyof T
        ? LeafAt<T[Head], Rest>
        : never
    : Path extends keyof T
      ? T[Path]
      : never;

type Placeholders<S> = S extends `${string}{${infer Name}}${infer Rest}`
    ? Name | Placeholders<Rest>
    : never;

type LeafPlaceholders<L> = L extends string
    ? Placeholders<L>
    : L extends { other: string }
      ? Placeholders<L[keyof L]> | 'count'
      : never;

export type ParamValue = string | number;

export type ParamsOf<K extends MessageKey> = [LeafPlaceholders<LeafAt<BaseMessages, K>>] extends [
    never,
]
    ? Record<string, never>
    : { [P in LeafPlaceholders<LeafAt<BaseMessages, K>>]: P extends 'count' ? number : ParamValue };

/** `t(key)` when the message has no placeholders, `t(key, params)` when it does. */
export type TranslateArgs<K extends MessageKey> = [
    LeafPlaceholders<LeafAt<BaseMessages, K>>,
] extends [never]
    ? [params?: Record<string, never>]
    : [params: ParamsOf<K>];

export type Translate = <K extends MessageKey>(key: K, ...args: TranslateArgs<K>) => string;
