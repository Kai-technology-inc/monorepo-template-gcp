import { defineConfig } from 'vitest/config';

/**
 * Unit and HTTP specs, with an in-memory store: no emulator needed. The architecture specs
 * (`vitest.arch.config.mts`, `pnpm test:arch`) and the security rules (`vitest.rules.config.mts`, `pnpm test:rules`)
 * run on their own.
 *
 * - Vite transpiles with oxc, told to emit the decorator metadata Nest's dependency injection reads.
 * - Other workspace packages are loaded from their built `dist/` by Node itself (`external`): they `require` each
 *   other, and a second copy of a module loaded by Vitest would make `overrideProvider(SomeClass)` miss the class
 *   the app actually injects.
 */
export default defineConfig({
    oxc: { decorator: { legacy: true, emitDecoratorMetadata: true } },
    test: {
        include: ['src/**/*.spec.ts'],
        exclude: ['node_modules/**', 'src/arch/**', 'src/**/*.rules.spec.ts'],
        environment: 'node',
        server: { deps: { external: [/\/packages\/[^/]+\/dist\//] } },
    },
});
