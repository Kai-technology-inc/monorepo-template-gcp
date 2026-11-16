import { ERROR_CODES, SUPPORTED_LOCALES } from '@app/contracts';
import { describe, expect, it } from 'vitest';
import { isPluralMessage, placeholdersOf } from '../format';
import { en } from './en';
import { loadMessages } from './index';

/**
 * WHAT THE TYPES CANNOT SEE
 *
 * `Messages` already makes a missing key a compile error. This spec covers the rest: a placeholder renamed in one
 * language (`{name}` vs `{nombre}`) prints a raw `{nombre}` on screen; an empty string renders nothing; a plural
 * without `other` breaks on the first count the language's rules route to it.
 */
type Leaf = { path: string; value: unknown };

function leaves(node: unknown, prefix = ''): Leaf[] {
    if (typeof node === 'string' || isPluralMessage(node)) return [{ path: prefix, value: node }];
    return Object.entries(node as Record<string, unknown>).flatMap(([key, child]) =>
        leaves(child, prefix ? `${prefix}.${key}` : key),
    );
}

function placeholdersOfLeaf(value: unknown): string[] {
    const texts =
        typeof value === 'string' ? [value] : Object.values(value as Record<string, string>);
    return [...new Set(texts.flatMap(placeholdersOf))].sort();
}

function tagsOf(value: unknown): string[] {
    const texts =
        typeof value === 'string' ? [value] : Object.values(value as Record<string, string>);
    return [
        ...new Set(
            texts.flatMap((text) =>
                [...text.matchAll(/<([a-zA-Z]+)>/g)].map((m) => m[1] as string),
            ),
        ),
    ].sort();
}

const base = new Map(leaves(en).map((leaf) => [leaf.path, leaf.value]));

describe.each(SUPPORTED_LOCALES)('dictionary %s', (locale) => {
    it('has exactly the keys of the base dictionary', async () => {
        const messages = await loadMessages(locale);
        expect(
            leaves(messages)
                .map((leaf) => leaf.path)
                .sort(),
        ).toEqual([...base.keys()].sort());
    });

    it('uses the same placeholders and tags as the base, key by key', async () => {
        const messages = await loadMessages(locale);
        for (const { path, value } of leaves(messages)) {
            const reference = base.get(path);
            const plural = isPluralMessage(reference);
            const expected = placeholdersOfLeaf(reference).filter(
                (name) => !(plural && name === 'count'),
            );
            const actual = placeholdersOfLeaf(value).filter(
                (name) => !(plural && name === 'count'),
            );
            expect({ path, placeholders: actual }).toEqual({ path, placeholders: expected });
            expect({ path, tags: tagsOf(value) }).toEqual({ path, tags: tagsOf(reference) });
        }
    });

    it('has no empty messages and every plural has an `other` form', async () => {
        const messages = await loadMessages(locale);
        for (const { path, value } of leaves(messages)) {
            if (typeof value === 'string')
                expect({ path, empty: value.trim() === '' }).toEqual({ path, empty: false });
            else
                expect({ path, other: typeof (value as { other?: unknown }).other }).toEqual({
                    path,
                    other: 'string',
                });
        }
    });
});

describe('error messages', () => {
    it('cover every error code of the API', () => {
        for (const code of ERROR_CODES) expect(Object.keys(en.errors)).toContain(code);
    });
});
