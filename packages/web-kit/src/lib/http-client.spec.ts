import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './api-error';
import { callApi, type HttpDeps } from './http-client';

function deps(
    response: Response | Error,
    token: string | null = 'id-token',
): HttpDeps & { fetch: ReturnType<typeof vi.fn> } {
    const fetchMock = vi.fn(async () => {
        if (response instanceof Error) throw response;
        return response;
    });
    return {
        fetch: fetchMock as unknown as typeof fetch & ReturnType<typeof vi.fn>,
        baseUrl: 'http://api.test',
        getToken: async () => token,
        newRequestId: () => 'req-1',
    };
}

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('callApi', () => {
    it('sends the token, the request id and the JSON body, and parses with the schema', async () => {
        const d = deps(json(200, { ok: true }));
        const result = await callApi(
            '/x',
            { method: 'POST', body: { a: 1 }, schema: z.object({ ok: z.boolean() }) },
            d,
        );
        expect(result).toEqual({ ok: true });
        const [url, init] = d.fetch.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('http://api.test/x');
        expect(init.headers).toMatchObject({
            Authorization: 'Bearer id-token',
            'X-Request-Id': 'req-1',
            'Content-Type': 'application/json',
        });
        expect(init.body).toBe('{"a":1}');
    });

    it('omits Authorization for anonymous calls', async () => {
        const d = deps(json(200, {}));
        await callApi('/x', { anonymous: true }, d);
        const [, init] = d.fetch.mock.calls[0] as [string, RequestInit];
        expect(init.headers).not.toHaveProperty('Authorization');
    });

    it('turns an ApiErrorBody into an ApiError with its code and issues', async () => {
        const d = deps(
            json(400, {
                statusCode: 400,
                code: 'VALIDATION_FAILED',
                message: 'bad',
                issues: { email: ['Invalid email'] },
            }),
        );
        await expect(callApi('/x', {}, d)).rejects.toMatchObject({
            code: 'VALIDATION_FAILED',
            status: 400,
            issues: { email: ['Invalid email'] },
        });
    });

    it('reports an unknown error for a body that is not an ApiErrorBody', async () => {
        const d = deps(new Response('<html>Bad gateway</html>', { status: 502 }));
        await expect(callApi('/x', {}, d)).rejects.toMatchObject({ code: 'unknown', status: 502 });
    });

    it('reports a network error when fetch throws', async () => {
        const d = deps(new TypeError('Failed to fetch'));
        const error = await callApi('/x', {}, d).catch((caught: unknown) => caught);
        expect(error).toBeInstanceOf(ApiError);
        expect(error).toMatchObject({ code: 'network', status: 0 });
    });

    it('refuses a response that does not match the schema', async () => {
        const d = deps(json(200, { ok: 'yes' }));
        await expect(
            callApi('/x', { schema: z.object({ ok: z.boolean() }) }, d),
        ).rejects.toMatchObject({
            code: 'unknown',
        });
    });

    it('resolves 204 without a schema', async () => {
        const d = deps(new Response(null, { status: 204 }));
        await expect(callApi('/x', { method: 'DELETE' }, d)).resolves.toBeUndefined();
    });
});
