// @ts-check
import { layerConfig } from '@app/eslint-config/node';

/** The local server composes the API packages; it never imports the web. */
export default layerConfig({
    dirname: import.meta.dirname,
    forbidden: ['@app/web-*', '@app/i18n', '@app/i18n/*', '@app/functions'],
    message: 'apps/api composes the API packages; it does not import the web or the Functions app.',
});
