// @ts-check
import { layerConfig } from '@app/eslint-config/node';

/**
 * Layer 2 of the API: the product's base modules. It imports the core and the contracts, never the composition
 * (`api-host`, the apps) nor anything of the web. A new product module is a new package at this layer
 * (docs/EXTENDING.md); it may import this one, but this one never imports it.
 */
export default layerConfig({
    dirname: import.meta.dirname,
    forbidden: [
        '@app/api-host',
        '@app/api-host/*',
        '@app/web-*',
        '@app/i18n',
        '@app/i18n/*',
        '@app/functions',
    ],
    message: 'api-workspace is layer 2: it imports only @app/api-core and @app/contracts.',
});
