// @ts-check
import { layerConfig } from '@app/eslint-config/node';

/**
 * The browser tests drive the web like a person and talk to the API over HTTP, like the web: they import the
 * contracts (routes, schemas) and the dictionaries (what the screen says), never the API or web packages.
 * `apps/api/src/arch/layers.spec.ts` enforces the same rule in CI.
 */
export default layerConfig({
    dirname: import.meta.dirname,
    forbidden: ['@app/api-*', '@app/web-*', '@app/functions'],
    message: 'The browser tests reach the product through the browser and HTTP only.',
});
