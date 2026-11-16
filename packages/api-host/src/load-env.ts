import * as dotenv from 'dotenv';

/**
 * THE DEPLOY'S `.env`, BEFORE ANY OPTION THAT DEPENDS ON IT
 *
 * firebase-tools discovers the Functions of a codebase by loading its bundle with a clean environment: of what the
 * deploy decided, the only thing it sees is the `.env` that `scripts/deploy-functions.sh` writes next to the
 * bundle. This loads it, and `function-options.ts` imports it first so options evaluated at load time
 * (`FUNCTIONS_REGION`, `FUNCTIONS_MAX_INSTANCES`) see the deploy's values. At runtime nothing changes: Cloud Run
 * already provides those variables.
 */
dotenv.config({ quiet: true });
