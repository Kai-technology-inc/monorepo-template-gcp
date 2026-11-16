// @ts-check
import { layerConfig } from '@app/eslint-config/node';

/**
 * The composition layer: it may import every API package below it, never the apps nor the web.
 */
export default layerConfig({
    dirname: import.meta.dirname,
    forbidden: ['@app/web-*', '@app/i18n', '@app/i18n/*', '@app/functions', '@app/api'],
    message: 'api-host composes the API packages; it does not import the apps or the web.',
});
