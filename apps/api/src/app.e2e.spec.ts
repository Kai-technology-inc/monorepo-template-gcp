import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
    CreateInvitationResponse,
    FlagListResponse,
    FlagState,
    MemberListResponse,
    Session,
} from '@app/contracts';
import { FIREBASE_APP, IdTokenVerifier } from '@app/api-core/firebase/firebase-admin.module';
import { Store } from '@app/api-core/persistence/store';
import { FakeTokenVerifier } from '@app/api-core/testing/fake-token-verifier';
import { InMemoryStore } from '@app/api-core/testing/in-memory-store';
import { configureApp } from '@app/api-host/app.setup';
import { AppModule } from './app.module';

/**
 * THE WHOLE APP OVER HTTP, WITHOUT EMULATORS
 *
 * The real `AppModule` (guard, pipes, filter, CORS, routing prefixes) with the two edges replaced: an in-memory
 * `Store` and a token verifier that accepts labels. It proves the wiring that unit specs cannot: that a route is
 * mounted where docs/API.md says, guarded the way it says, and answers the documented shape.
 */
describe('API over HTTP', () => {
    let app: INestApplication;
    let base: string;
    const verifier = new FakeTokenVerifier()
        .issue('ada', { uid: 'ada', email: 'ada@example.com', email_verified: true, name: 'Ada' })
        .issue('bob', { uid: 'bob', email: 'bob@example.com', email_verified: true })
        .issue('eve', { uid: 'eve', email: 'eve@example.com', email_verified: false })
        .issue('ops', { uid: 'ops', email: 'ops@example.com', email_verified: true })
        .issue('cus', { uid: 'cus', email: 'cus@example.com', email_verified: true });

    beforeAll(async () => {
        process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
        process.env.AUTH_REQUIRE_VERIFIED_EMAIL = 'true';
        const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
            .overrideProvider(FIREBASE_APP)
            .useValue({})
            .overrideProvider(Store)
            .useValue(new InMemoryStore())
            .overrideProvider(IdTokenVerifier)
            .useValue(verifier)
            .compile();
        app = moduleRef.createNestApplication({ logger: false });
        configureApp(app, { swagger: false });
        await app.listen(0, '127.0.0.1');
        base = await app.getUrl();
    });

    afterAll(async () => {
        await app.close();
    });

    async function call<T = unknown>(
        method: string,
        path: string,
        token?: string,
        body?: unknown,
        headers: Record<string, string> = {},
    ): Promise<{ status: number; body: T; headers: Headers }> {
        const response = await fetch(`${base}${path}`, {
            method,
            headers: {
                ...(token ? { authorization: `Bearer ${token}` } : {}),
                ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
                ...headers,
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const text = await response.text();
        return {
            status: response.status,
            body: (text ? JSON.parse(text) : null) as T,
            headers: response.headers,
        };
    }

    it('serves the health checks of both functions without a token', async () => {
        expect((await call('GET', '/account/health')).body).toEqual({
            status: 'ok',
            service: 'account',
        });
        expect((await call('GET', '/workspaces/health')).body).toEqual({
            status: 'ok',
            service: 'workspaces',
        });
    });

    it('answers unknown routes and bad tokens with the error contract and a request id', async () => {
        const unknown = await call('GET', '/account/nope', 'ada');
        expect(unknown).toMatchObject({ status: 404, body: { code: 'NOT_FOUND' } });
        const anonymous = await call('GET', '/account/session', undefined, undefined, {
            'x-request-id': 'trace-1234',
        });
        expect(anonymous).toMatchObject({
            status: 401,
            body: { code: 'UNAUTHENTICATED', requestId: 'trace-1234' },
        });
        expect(anonymous.headers.get('x-request-id')).toBe('trace-1234');
    });

    it('runs the whole flow: register, invite, accept, manage', async () => {
        expect(await call('GET', '/account/session', 'ada')).toMatchObject({
            status: 403,
            body: { code: 'NOT_REGISTERED' },
        });

        const registered = await call<Session>('POST', '/account/register', 'ada', {
            displayName: 'Ada',
            locale: 'es',
            workspaceName: 'Acme',
        });
        expect(registered).toMatchObject({
            status: 201,
            body: { role: 'OWNER', workspace: { slug: 'acme' } },
        });
        const workspaceId = registered.body.workspace?.id as string;

        expect(
            await call('POST', '/account/register', 'bob', {
                displayName: 'Bob',
                locale: 'en',
                extra: 1,
            }),
        ).toMatchObject({
            status: 400,
            body: { code: 'VALIDATION_FAILED', issues: { _: expect.any(Array) as unknown } },
        });

        const created = await call<CreateInvitationResponse>(
            'POST',
            `/workspaces/${workspaceId}/invitations`,
            'ada',
            {
                email: 'BOB@example.com',
                role: 'ADMIN',
            },
        );
        expect(created).toMatchObject({
            status: 201,
            body: { invitation: { email: 'bob@example.com' } },
        });
        const query = new URLSearchParams(created.body.acceptPath.split('?')[1]);
        const invitationId = query.get('invitation') as string;
        const token = query.get('token') as string;

        expect(
            (
                await call(
                    'GET',
                    `/workspaces/${workspaceId}/invitations/${invitationId}/preview?token=${token}`,
                )
            ).body,
        ).toMatchObject({ workspaceName: 'Acme', role: 'ADMIN' });

        await call('POST', '/account/register', 'bob', { displayName: 'Bob', locale: 'en' });
        expect(await call('GET', `/workspaces/${workspaceId}/members`, 'bob')).toMatchObject({
            status: 403,
            body: { code: 'NOT_A_MEMBER' },
        });
        const accepted = await call<Session>(
            'POST',
            `/workspaces/${workspaceId}/invitations/${invitationId}/accept`,
            'bob',
            { token },
        );
        expect(accepted).toMatchObject({
            status: 200,
            body: { role: 'ADMIN', workspace: { id: workspaceId } },
        });

        const members = await call<MemberListResponse>(
            'GET',
            `/workspaces/${workspaceId}/members`,
            'bob',
        );
        expect(members.body.members.map((m) => [m.userId, m.role])).toEqual([
            ['ada', 'OWNER'],
            ['bob', 'ADMIN'],
        ]);

        expect(
            await call('PATCH', `/workspaces/${workspaceId}/members/ada`, 'bob', {
                role: 'MEMBER',
            }),
        ).toMatchObject({
            status: 403,
            body: { code: 'FORBIDDEN' },
        });
        expect(await call('DELETE', `/workspaces/${workspaceId}/members/ada`, 'ada')).toMatchObject(
            {
                status: 409,
                body: { code: 'LAST_OWNER' },
            },
        );
        expect((await call('DELETE', `/workspaces/${workspaceId}/members/bob`, 'bob')).status).toBe(
            204,
        );
    });

    it('keeps unverified emails out of workspace routes but lets them read their session', async () => {
        await call('POST', '/account/register', 'eve', {
            displayName: 'Eve',
            locale: 'en',
            workspaceName: 'Eve Co',
        });
        const session = await call<Session>('GET', '/account/session', 'eve');
        expect(session.body).toMatchObject({
            emailVerified: false,
            emailVerificationRequired: true,
        });
        expect(
            await call('GET', `/workspaces/${session.body.workspace?.id}/members`, 'eve'),
        ).toMatchObject({ status: 403, body: { code: 'EMAIL_NOT_VERIFIED' } });
    });

    it('operates flags from the operator workspace, and the session follows', async () => {
        const ops = await call<Session>('POST', '/account/register', 'ops', {
            displayName: 'Ops',
            locale: 'en',
            workspaceName: 'Operators',
        });
        const customer = await call<Session>('POST', '/account/register', 'cus', {
            displayName: 'Cus',
            locale: 'en',
            workspaceName: 'Customer',
        });
        const operators = ops.body.workspace?.id as string;
        const customers = customer.body.workspace?.id as string;
        expect(ops.body.flags).toEqual({ 'dashboard-whats-new': false });

        process.env.FLAGS_ADMIN_WORKSPACE_ID = operators;
        try {
            const flag = `/workspaces/${operators}/flags/dashboard-whats-new`;
            expect(await call('GET', `/workspaces/${customers}/flags`, 'cus')).toMatchObject({
                status: 403,
                body: { code: 'FORBIDDEN' },
            });
            expect(
                (await call<FlagListResponse>('GET', `/workspaces/${operators}/flags`, 'ops')).body,
            ).toMatchObject({ provider: 'firestore', flags: [{ key: 'dashboard-whats-new' }] });
            expect(await call('PUT', flag, 'ops', { value: 'yes' })).toMatchObject({
                status: 400,
                body: {
                    code: 'VALIDATION_FAILED',
                    issues: { value: expect.any(Array) as unknown },
                },
            });
            expect(
                await call('GET', `/workspaces/${operators}/flags/not-declared`, 'ops'),
            ).toMatchObject({ status: 404 });

            const team = await call<FlagState>('PUT', flag, 'ops', {
                value: true,
                allowList: { workspaceIds: [operators] },
            });
            expect(team).toMatchObject({
                status: 200,
                body: { rule: { enabled: true, value: true }, updatedBy: 'ops' },
            });
            const flagOf = async (token: string) =>
                (await call<Session>('GET', '/account/session', token)).body.flags[
                    'dashboard-whats-new'
                ];
            expect(await flagOf('ops')).toBe(true);
            expect(await flagOf('cus')).toBe(false);

            expect((await call('DELETE', flag, 'ops')).status).toBe(204);
            expect(await flagOf('ops')).toBe(false);
        } finally {
            delete process.env.FLAGS_ADMIN_WORKSPACE_ID;
        }
    });

    it('refuses ids that would change the Firestore path', async () => {
        expect(await call('GET', '/workspaces/a%2Fmembers%2Fx/members', 'ada')).toMatchObject({
            status: 404,
        });
    });

    it('allows only the configured origin', async () => {
        const allowed = await fetch(`${base}/account/session`, {
            method: 'OPTIONS',
            headers: { origin: 'http://localhost:3000', 'access-control-request-method': 'GET' },
        });
        expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
        const other = await fetch(`${base}/account/session`, {
            method: 'OPTIONS',
            headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' },
        });
        expect(other.headers.get('access-control-allow-origin')).toBeNull();
    });
});
