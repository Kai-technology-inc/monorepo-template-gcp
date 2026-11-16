// @ts-check
import { webConfig } from '@app/eslint-config/next';

/** The kit sits under the screens: it never imports `@app/web-platform` or the app. */
export default webConfig({ forbidden: ['@app/web-platform', '@/*'] });
