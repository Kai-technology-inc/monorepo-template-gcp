// @ts-check
import { layerConfig } from '@app/eslint-config/node';

/**
 * Layer 1 of the API. The core imports only the contracts: no product module, no other API package, no
 * composition. What it needs from above reaches it through a port or a registry.
 * `apps/api/src/arch/layers.spec.ts` enforces the same rule in CI.
 */
export default layerConfig({
    dirname: import.meta.dirname,
    forbidden: ['@app/api-*', '@app/web-*', '@app/i18n', '@app/i18n/*', '@app/functions'],
    message: 'api-core is layer 1: it imports only @app/contracts.',
});
