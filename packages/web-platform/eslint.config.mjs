// @ts-check
import { webConfig } from '@app/eslint-config/next';

/** Screens use the kit and the contracts; they never import the app (`@/`). */
export default webConfig({ forbidden: ['@/*'] });
