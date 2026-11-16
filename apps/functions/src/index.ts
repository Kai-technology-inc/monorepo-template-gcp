// First: the global options, which load the deploy's `.env` before anything reads it.
import { applyGlobalFunctionOptions } from '@app/api-host/function-options';
import type { ApiFunctionName } from '@app/contracts';
import { createHttpFunction } from '@app/api-host/http-function';
import { createNestHost, type FunctionDefinition } from '@app/api-host/nest-host';

applyGlobalFunctionOptions();

/**
 * THE FUNCTIONS OF THIS CODEBASE
 *
 * One HTTP Function per entry of `API_FUNCTIONS`, each booting only its own product module (loaded lazily, so a
 * cold start of `account` never pays for `workspaces`). The local server (`apps/api/src/app.module.ts`) mounts the
 * same modules under the same names. To add one: a name in `API_FUNCTIONS`, an entry here, an export below, a line
 * in the local `FUNCTION_MODULES`.
 *
 * `index.spec.ts` checks that every name in `API_FUNCTIONS` is exported here.
 *
 * Per-Function options go in `createHttpFunction(host, name, { memory: '1GiB', timeoutSeconds: 120, secrets: [...] })`.
 */
const DEFINITIONS: Readonly<Record<ApiFunctionName, FunctionDefinition>> = {
    account: {
        route: 'account',
        title: 'Account API',
        load: async () => [
            (await import('@app/api-workspace/account/account.module')).AccountModule,
        ],
    },
    workspaces: {
        route: 'workspaces',
        title: 'Workspaces API',
        load: async () => [
            (await import('@app/api-workspace/workspaces/workspaces.module')).WorkspacesModule,
        ],
    },
};

const host = createNestHost(DEFINITIONS);

export const account = createHttpFunction(host, 'account');
export const workspaces = createHttpFunction(host, 'workspaces');
