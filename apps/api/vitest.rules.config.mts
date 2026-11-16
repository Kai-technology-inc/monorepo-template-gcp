import { defineConfig } from 'vitest/config';

/**
 * The security rules against the Firestore/Storage emulators. Run with `pnpm test:rules` (it starts them).
 *
 * - Vite transpiles with oxc, told to emit the decorator metadata Nest's dependency injection reads.
 * - Other workspace packages are loaded from their built `dist/` by Node itself (`external`): they `require` each
 *   other, and a second copy of a module loaded by Vitest would make `overrideProvider(SomeClass)` miss the class
 *   the app actually injects.
 */
export default defineConfig({
    oxc: { decorator: { legacy: true, emitDecoratorMetadata: true } },
    test: {
        include: ['src/**/*.rules.spec.ts'],
        exclude: ['node_modules/**'],
        environment: 'node',
        // One emulator, shared state: the files run one after another.
        fileParallelism: false,
        server: { deps: { external: [/\/packages\/[^/]+\/dist\//] } },
    },
});
