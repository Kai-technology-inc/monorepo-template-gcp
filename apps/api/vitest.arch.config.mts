import { defineConfig } from 'vitest/config';

/**
 * Specs that read the whole repository (layers, URL vocabulary, docs coverage). Run with `pnpm test:arch`.
 *
 * - Vite transpiles with oxc, told to emit the decorator metadata Nest's dependency injection reads.
 * - Other workspace packages are loaded from their built `dist/` by Node itself (`external`): they `require` each
 *   other, and a second copy of a module loaded by Vitest would make `overrideProvider(SomeClass)` miss the class
 *   the app actually injects.
 */
export default defineConfig({
    oxc: { decorator: { legacy: true, emitDecoratorMetadata: true } },
    test: {
        include: ['src/arch/**/*.spec.ts'],
        exclude: ['node_modules/**'],
        environment: 'node',
        server: { deps: { external: [/\/packages\/[^/]+\/dist\//] } },
    },
});
