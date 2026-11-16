// @ts-check
import { layerConfig } from '@app/eslint-config/node';

/**
 * Layer 0. The contracts import nothing from the workspace: every other package depends on them, so a single
 * import from above would make a cycle. `apps/api/src/arch/layers.spec.ts` enforces the same rule in CI.
 */
export default layerConfig({
    dirname: import.meta.dirname,
    forbidden: ['@app/*'],
    message: 'Contracts are layer 0: they import nothing from the workspace.',
});
