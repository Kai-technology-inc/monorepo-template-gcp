import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Controller, Get, Post, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AllExceptionsFilter } from '../http/all-exceptions.filter';
import { TestPlatformModule } from '../testing/test-platform.module';
import { FakeTokenVerifier } from '../testing/fake-token-verifier';
import { InMemoryStore } from '../testing/in-memory-store';
import type { AuthContext, Identity } from './auth-context';
import { AuthModule } from './auth.module';
import {
    AllowUnverifiedEmail,
    CurrentAuth,
    CurrentIdentity,
    IdentityOnly,
    OutsideWorkspace,
    Public,
    RequirePermission,
} from './decorators';

@Controller()
class ProbeController {
    @Public() @Get('public') open(): { ok: boolean } {
        return { ok: true };
    }
    @IdentityOnly() @Post('register') register(@CurrentIdentity() identity: Identity): Identity {
        return identity;
    }
    @AllowUnverifiedEmail() @Get('session') session(@CurrentAuth() auth: AuthContext): AuthContext {
        return auth;
    }
    @Get('workspaces/:workspaceId') read(@CurrentAuth() auth: AuthContext): AuthContext {
        return auth;
    }
    @RequirePermission('members:manage') @Post('workspaces/:workspaceId/manage') manage(): {
        managed: boolean;
    } {
        return { managed: true };
    }
    @OutsideWorkspace() @Post('workspaces/:workspaceId/accept') accept(
        @CurrentAuth() auth: AuthContext,
    ): AuthContext {
        return auth;
    }
}

const NOW = '2026-01-01T00:00:00.000Z';

describe('FirebaseAuthGuard', () => {
    let app: INestApplication;
    let base: string;
    const store = new InMemoryStore();
    const verifier = new FakeTokenVerifier()
        .issue('owner', { uid: 'u1', email: 'Owner@Example.com', email_verified: true })
        .issue('member', { uid: 'u2', email: 'member@example.com', email_verified: true })
        .issue('unverified', { uid: 'u3', email: 'u3@example.com', email_verified: false })
        .issue('stranger', { uid: 'u4', email: 'u4@example.com', email_verified: true });

    beforeAll(async () => {
        process.env.AUTH_REQUIRE_VERIFIED_EMAIL = 'true';
        const user = (id: string, active: string | null) => ({
            id,
            email: `${id}@example.com`,
            displayName: id,
            locale: 'en',
            activeWorkspaceId: active,
            createdAt: NOW,
            updatedAt: NOW,
        });
        store.seed('users/u1', user('u1', 'w1'));
        store.seed('users/u2', user('u2', 'w1'));
        store.seed('users/u3', user('u3', 'w1'));
        store.seed('users/u4', user('u4', null));
        const member = (userId: string, role: string) => ({
            userId,
            workspaceId: 'w1',
            email: `${userId}@example.com`,
            displayName: userId,
            role,
            joinedAt: NOW,
        });
        store.seed('workspaces/w1/members/u1', member('u1', 'OWNER'));
        store.seed('workspaces/w1/members/u2', member('u2', 'MEMBER'));
        store.seed('workspaces/w1/members/u3', member('u3', 'MEMBER'));

        const moduleRef = await Test.createTestingModule({
            imports: [TestPlatformModule.with({ store, verifier }), AuthModule],
            controllers: [ProbeController],
        }).compile();
        app = moduleRef.createNestApplication({ logger: false });
        app.useGlobalFilters(new AllExceptionsFilter());
        await app.listen(0, '127.0.0.1');
        base = await app.getUrl();
    });

    afterAll(async () => {
        await app.close();
    });

    afterEach(() => {
        process.env.AUTH_REQUIRE_VERIFIED_EMAIL = 'true';
    });

    async function call(
        method: string,
        path: string,
        token?: string,
    ): Promise<{ status: number; body: unknown }> {
        const response = await fetch(`${base}${path}`, {
            method,
            headers: token ? { authorization: `Bearer ${token}` } : {},
        });
        const text = await response.text();
        return { status: response.status, body: text ? (JSON.parse(text) as unknown) : null };
    }

    it('lets public routes through without a token', async () => {
        expect((await call('GET', '/public')).status).toBe(200);
    });

    it('rejects a missing or invalid token', async () => {
        expect(await call('GET', '/session')).toMatchObject({
            status: 401,
            body: { code: 'UNAUTHENTICATED' },
        });
        expect(await call('GET', '/session', 'forged')).toMatchObject({
            status: 401,
            body: { code: 'UNAUTHENTICATED' },
        });
    });

    it('gives identity-only routes the lowercased identity', async () => {
        const { body } = await call('POST', '/register', 'owner');
        expect(body).toMatchObject({
            userId: 'u1',
            email: 'owner@example.com',
            emailVerified: true,
        });
    });

    it('blocks unverified emails except where allowed, and only when required', async () => {
        expect(await call('GET', '/workspaces/w1', 'unverified')).toMatchObject({
            status: 403,
            body: { code: 'EMAIL_NOT_VERIFIED' },
        });
        expect((await call('GET', '/session', 'unverified')).status).toBe(200);
        process.env.AUTH_REQUIRE_VERIFIED_EMAIL = 'false';
        expect((await call('GET', '/workspaces/w1', 'unverified')).status).toBe(200);
    });

    it('resolves the role in the route workspace and requires membership', async () => {
        expect((await call('GET', '/workspaces/w1', 'owner')).body).toMatchObject({
            workspaceId: 'w1',
            role: 'OWNER',
        });
        expect(await call('GET', '/workspaces/w1', 'stranger')).toMatchObject({
            status: 403,
            body: { code: 'NOT_A_MEMBER' },
        });
        expect((await call('POST', '/workspaces/w1/accept', 'stranger')).body).toMatchObject({
            role: null,
        });
    });

    it('enforces permissions', async () => {
        expect((await call('POST', '/workspaces/w1/manage', 'owner')).status).toBe(201);
        expect(await call('POST', '/workspaces/w1/manage', 'member')).toMatchObject({
            status: 403,
            body: { code: 'FORBIDDEN' },
        });
    });

    it('rejects a registered identity without profile with NOT_REGISTERED', async () => {
        verifier.issue('ghost', { uid: 'u9', email: 'g@example.com', email_verified: true });
        expect(await call('GET', '/session', 'ghost')).toMatchObject({
            status: 403,
            body: { code: 'NOT_REGISTERED' },
        });
    });
});
