// First: the deploy's `.env`, so the options below see it (`load-env.ts` explains why).
import './load-env';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import { readNumber } from '@app/api-core/config/environment';

/**
 * What every Function of the codebase inherits: region, instance ceiling and memory. A Function that needs more
 * declares it in its own definition (`createHttpFunction(host, name, { memory: '1GiB' })`).
 */
export function applyGlobalFunctionOptions(): void {
    setGlobalOptions({
        region: process.env.FUNCTIONS_REGION ?? 'us-central1',
        maxInstances: readNumber('FUNCTIONS_MAX_INSTANCES', 10),
        memory: '512MiB',
        ...(process.env.FUNCTIONS_SERVICE_ACCOUNT
            ? { serviceAccount: process.env.FUNCTIONS_SERVICE_ACCOUNT }
            : {}),
    });
}
