import { defineConfig } from 'vitest/config';

/**
 * Node, not jsdom: the kit's rules are pure functions (`src/lib`) and its components are checked by rendering them
 * to a string. A spec that needs clicks and effects is testing behaviour that belongs in a function.
 */
export default defineConfig({
    test: { include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'], environment: 'node' },
});
