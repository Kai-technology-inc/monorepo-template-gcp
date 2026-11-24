// @ts-check
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

/**
 * THE WEB PACKAGES
 *
 * Next's recommended rules plus two of ours:
 *
 * - **No hardcoded text in JSX** (`react/jsx-no-literals`). Everything a person reads comes from the dictionaries
 *   of `@app/i18n` through `t(...)`. Punctuation and symbols are allowed; a word is not. If a string truly is not
 *   copy (a brand name, a code sample), add it to `allowedStrings` in the package's config with a reason.
 * - **The layer guard**: a web package never imports the API (`@app/api-*`), only the contracts; nor a dictionary
 *   file directly (`@app/i18n/messages/en`, for tests and tools): the layout hands each page its language.
 *
 * @param {{ forbidden?: string[]; allowedStrings?: string[]; ignores?: string[] }} [options]
 */
export function webConfig({ forbidden = [], allowedStrings = [], ignores = [] } = {}) {
    return [
        ...nextVitals,
        ...nextTypeScript,
        { ignores: ['.next/**', 'node_modules/**', 'dist/**', ...ignores] },
        {
            rules: {
                'react/jsx-no-literals': [
                    'error',
                    {
                        noStrings: false,
                        ignoreProps: true,
                        allowedStrings: [
                            '·',
                            '—',
                            '–',
                            '…',
                            '/',
                            '|',
                            '•',
                            '×',
                            '→',
                            '←',
                            '©',
                            ':',
                            '*',
                            ...allowedStrings,
                        ],
                    },
                ],
                'no-restricted-imports': [
                    'error',
                    {
                        patterns: [
                            {
                                group: ['@app/api-*', '@app/functions', ...forbidden],
                                message:
                                    'A web package only talks to the API over HTTP, through the contracts (@app/contracts).',
                            },
                            {
                                // The base dictionary, for tests and tools. A screen that imported it would ship
                                // English to every visitor: the layout loads the request's language instead.
                                group: ['@app/i18n/messages/*'],
                                message:
                                    'Screens get their dictionary from the layout (useT); @app/i18n/messages/en is for tests and tools.',
                            },
                        ],
                    },
                ],
            },
        },
        {
            files: ['**/*.spec.ts', '**/*.spec.tsx'],
            rules: { 'react/jsx-no-literals': 'off' },
        },
    ];
}
