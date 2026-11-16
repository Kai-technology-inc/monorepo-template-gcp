import { describe, expect, it } from 'vitest';
import { aSession } from './fixtures';
import { gateDecision } from './gate';

describe('gateDecision', () => {
    it('waits while loading', () => {
        expect(gateDecision('loading', null, '/members')).toEqual({ kind: 'wait' });
    });

    it('sends a signed-out visitor to sign in and back', () => {
        expect(gateDecision('signed-out', null, '/members?tab=x')).toEqual({
            kind: 'redirect',
            to: '/auth/login?next=%2Fmembers%3Ftab%3Dx',
        });
    });

    it('sends an identity without profile to finish registration', () => {
        expect(gateDecision('unregistered', null, '/dashboard')).toEqual({
            kind: 'redirect',
            to: '/auth/register?next=%2Fdashboard',
        });
    });

    it('asks for email verification when required', () => {
        expect(gateDecision('ready', aSession({ emailVerified: false }), '/dashboard')).toEqual({
            kind: 'redirect',
            to: '/auth/verify-email?next=%2Fdashboard',
        });
        expect(
            gateDecision(
                'ready',
                aSession({ emailVerified: false, emailVerificationRequired: false }),
                '/dashboard',
            ),
        ).toEqual({ kind: 'render' });
    });

    it('sends someone without a workspace to settings, and lets them stay there', () => {
        const session = aSession({ workspace: null, role: null, permissions: [], memberships: [] });
        expect(gateDecision('ready', session, '/members')).toEqual({
            kind: 'redirect',
            to: '/settings',
        });
        expect(gateDecision('ready', session, '/settings')).toEqual({ kind: 'render' });
    });

    it('renders for a complete session and reports errors', () => {
        expect(gateDecision('ready', aSession(), '/members')).toEqual({ kind: 'render' });
        expect(gateDecision('error', null, '/members')).toEqual({ kind: 'error' });
    });
});
