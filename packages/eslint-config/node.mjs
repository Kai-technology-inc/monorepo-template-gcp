// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * THE LAYER, IN THE EDITOR
 *
 * Every Node package (contracts, api-*) declares which workspace packages sit *above* it and therefore cannot be
 * imported. The editor flags the import as you type it; `apps/api/src/arch/layers.spec.ts` is the half that cannot
 * be silenced with a comment and runs in CI.
 *
 * @param {{ dirname: string; forbidden: string[]; message: string }} options
 */
export function layerConfig({ dirname, forbidden, message }) {
    return tseslint.config(
        { ignores: ['dist/**', 'node_modules/**', '**/coverage/**', '*.js', '*.mjs'] },
        eslint.configs.recommended,
        ...tseslint.configs.recommendedTypeChecked,
        eslintPluginPrettierRecommended,
        {
            languageOptions: {
                globals: globals.node,
                parserOptions: { projectService: true, tsconfigRootDir: dirname },
            },
            rules: {
                '@typescript-eslint/no-floating-promises': 'error',
                '@typescript-eslint/no-explicit-any': 'error',
                '@typescript-eslint/explicit-function-return-type': [
                    'error',
                    { allowExpressions: true, allowTypedFunctionExpressions: true },
                ],
                // Server runtime: nothing goes to console directly, everything through Nest's Logger.
                'no-console': 'error',
                eqeqeq: ['error', 'smart'],
                'no-restricted-imports': [
                    'error',
                    { patterns: forbidden.length ? [{ group: forbidden, message }] : [] },
                ],
                // `_` marks what is discarded on purpose (parameters an interface imposes, omitted fields).
                '@typescript-eslint/no-unused-vars': [
                    'error',
                    {
                        argsIgnorePattern: '^_',
                        varsIgnorePattern: '^_',
                        caughtErrorsIgnorePattern: '^_',
                        ignoreRestSiblings: true,
                    },
                ],
            },
        },
        {
            files: ['**/*.spec.ts', '**/testing/**/*.ts'],
            rules: {
                '@typescript-eslint/explicit-function-return-type': 'off',
                '@typescript-eslint/unbound-method': 'off',
            },
        },
    );
}
