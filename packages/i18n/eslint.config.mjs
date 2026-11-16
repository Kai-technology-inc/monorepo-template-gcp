// @ts-check
import { webConfig } from '@app/eslint-config/next';

/** The i18n module sits right above the contracts: it imports nothing else from the workspace. */
export default webConfig({ forbidden: ['@app/web-*'] });
