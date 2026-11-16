// @ts-check
import { layerConfig } from '@app/eslint-config/node';

/** The Functions codebase composes the API packages; it never imports the web or the local server. */
export default layerConfig({
    dirname: import.meta.dirname,
    forbidden: ['@app/web-*', '@app/i18n', '@app/i18n/*', '@app/api'],
    message:
        'apps/functions composes the API packages; it does not import the web or the local server.',
});
