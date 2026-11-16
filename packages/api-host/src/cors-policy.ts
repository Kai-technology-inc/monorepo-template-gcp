import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { REQUEST_ID_HEADER } from '@app/contracts';

/**
 * CORS for an API that serves tenant data: only the web's origins (`ALLOWED_ORIGINS`), and none when the list is
 * empty. The credential is a bearer token the web sets on purpose, never a cookie, so `credentials` stays off.
 * A new custom header the web sends must be named here, or the browser stops the request at the preflight and the
 * only symptom is "Failed to fetch".
 */
export function corsOptions(allowedOrigins: readonly string[]): CorsOptions {
    return {
        origin: allowedOrigins.length > 0 ? [...allowedOrigins] : false,
        credentials: false,
        methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Authorization', 'Content-Type', REQUEST_ID_HEADER],
        exposedHeaders: [REQUEST_ID_HEADER],
        maxAge: 3600,
    };
}
