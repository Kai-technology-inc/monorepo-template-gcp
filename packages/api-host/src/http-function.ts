import { onRequest, type HttpsOptions, type Request } from 'firebase-functions/v2/https';
import { stripFunctionPrefix } from './function-prefix';
import type { NestHost } from './nest-host';

type HttpsFunction = ReturnType<typeof onRequest>;
type FirebaseResponse = Parameters<Parameters<typeof onRequest>[0]>[1];

async function handle<TName extends string>(
    host: NestHost<TName>,
    name: TName,
    request: Request,
    response: FirebaseResponse,
): Promise<void> {
    const server = await host.getExpressServer(name);
    const rewritten = stripFunctionPrefix(request.url, host.routeOf(name));
    const original = {
        url: request.url,
        baseUrl: request.baseUrl,
        originalUrl: request.originalUrl,
    };
    request.url = rewritten;
    request.baseUrl = '';
    request.originalUrl = rewritten;
    try {
        await new Promise<void>((resolve) => {
            response.on('finish', resolve);
            response.on('close', resolve);
            server(request, response);
        });
    } finally {
        request.url = original.url;
        request.baseUrl = original.baseUrl;
        request.originalUrl = original.originalUrl;
    }
}

/**
 * The HTTP Function of one entry of the host: public at the network level (the guard authenticates each route),
 * with the global options plus whatever this Function overrides (`memory`, `timeoutSeconds`, `secrets`).
 */
export function createHttpFunction<TName extends string>(
    host: NestHost<TName>,
    name: TName,
    options: Omit<HttpsOptions, 'invoker' | 'cors'> = {},
): HttpsFunction {
    return onRequest({ ...options, invoker: 'public' }, (request, response) =>
        handle(host, name, request, response),
    );
}
