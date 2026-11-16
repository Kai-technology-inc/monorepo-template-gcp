import type { z } from 'zod';
import { REQUEST_ID_HEADER } from '@app/contracts';
import { ApiError, apiErrorFromResponse } from './api-error';
import { readWebEnv } from './env';
import { firebaseAuth } from './firebase';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface CallApiOptions<T> {
    readonly method?: HttpMethod;
    readonly body?: unknown;
    /** Parses the response. Omit only for `204 No Content`. */
    readonly schema?: z.ZodType<T>;
    /** Send without `Authorization` (public routes such as an invitation preview). */
    readonly anonymous?: boolean;
    readonly signal?: AbortSignal;
}

export interface HttpDeps {
    readonly fetch: typeof fetch;
    readonly baseUrl: string;
    readonly getToken: () => Promise<string | null>;
    readonly newRequestId: () => string;
}

function defaultDeps(): HttpDeps {
    return {
        fetch: (...args) => fetch(...args),
        baseUrl: readWebEnv().apiBaseUrl,
        getToken: async () => (await firebaseAuth().currentUser?.getIdToken()) ?? null,
        newRequestId: () => globalThis.crypto.randomUUID(),
    };
}

/**
 * THE ONLY WAY THE WEB TALKS TO THE API
 *
 * Builds the URL from `apiRoutes` paths, attaches the Firebase ID token and a request id, parses the response with
 * the contract's zod schema, and turns every failure into an `ApiError` with a code the screens can translate.
 * A response that does not match its schema is an `unknown` error: the web never renders data it did not validate.
 */
export async function callApi<T = void>(
    path: string,
    options: CallApiOptions<T> = {},
    deps: HttpDeps = defaultDeps(),
): Promise<T> {
    const { method = 'GET', body, schema, anonymous, signal } = options;
    const requestId = deps.newRequestId();
    const headers: Record<string, string> = {
        Accept: 'application/json',
        [REQUEST_ID_HEADER]: requestId,
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (!anonymous) {
        const token = await deps.getToken();
        if (token) headers.Authorization = `Bearer ${token}`;
    }

    let response: Response;
    try {
        response = await deps.fetch(`${deps.baseUrl}${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            signal,
        });
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        throw new ApiError(
            'network',
            0,
            error instanceof Error ? error.message : 'Network error',
            {},
            requestId,
        );
    }

    const text = await response.text();
    let payload: unknown = undefined;
    if (text) {
        try {
            payload = JSON.parse(text);
        } catch {
            payload = text;
        }
    }

    if (!response.ok) throw apiErrorFromResponse(response.status, payload);
    if (!schema) return undefined as T;
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
        throw new ApiError(
            'unknown',
            response.status,
            `Unexpected response for ${method} ${path}`,
            {},
            requestId,
        );
    }
    return parsed.data;
}
