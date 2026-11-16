import { defineConfig } from 'vitest/config';

/**
 * Node, not jsdom. The rules a screen leans on live in `src/lib` as pure functions with their specs; screens whose
 * job is choosing what to say are checked by rendering a pure view to a string (`*.spec.tsx`).
 */
export default defineConfig({
    test: { include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'], environment: 'node' },
});
