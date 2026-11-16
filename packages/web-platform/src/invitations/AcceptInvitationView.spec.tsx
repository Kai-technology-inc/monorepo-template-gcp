import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Messages } from '@app/i18n';
import { loadMessages } from '@app/i18n/messages';
import { I18nProvider } from '@app/i18n/react';
import type { AcceptState } from '../lib/accept-invitation';
import { AcceptInvitationView, type AcceptInvitationViewProps } from './AcceptInvitationView';

const noop = () => undefined;
const dictionaries: Record<'en' | 'es', Messages> = {
    en: await loadMessages('en'),
    es: await loadMessages('es'),
};
const props = (
    state: AcceptState,
    overrides: Partial<AcceptInvitationViewProps> = {},
): AcceptInvitationViewProps => ({
    state,
    preview: {
        workspaceName: 'Acme',
        email: 'bob@example.com',
        role: 'ADMIN',
        expiresAt: '2026-12-01T00:00:00Z',
    },
    signedInEmail: null,
    loginHref: '/auth/login?next=x',
    registerHref: '/auth/register?email=bob%40example.com&next=x',
    verifyHref: '/auth/verify-email?next=x',
    busy: false,
    error: null,
    onAccept: noop,
    onSwitchAccount: noop,
    onRetry: noop,
    ...overrides,
});

function render(
    state: AcceptState,
    overrides: Partial<AcceptInvitationViewProps> = {},
    locale: 'en' | 'es' = 'en',
) {
    return renderToStaticMarkup(
        <I18nProvider locale={locale} messages={dictionaries[locale]}>
            <AcceptInvitationView {...props(state, overrides)} />
        </I18nProvider>,
    );
}

describe('AcceptInvitationView', () => {
    it('invites a signed-out visitor to sign in or register, keeping the link', () => {
        const html = render('signed-out');
        expect(html).toContain('Join Acme');
        expect(html).toContain('bob@example.com was invited as Admin.');
        expect(html).toContain('href="/auth/login?next=x"');
        expect(html).toContain('href="/auth/register?email=bob%40example.com&amp;next=x"');
    });

    it('explains a wrong account and offers to switch', () => {
        const html = render('wrong-account', { signedInEmail: 'ada@example.com' });
        expect(html).toContain(
            'You are signed in as ada@example.com, but this invitation is for bob@example.com.',
        );
        expect(html).toContain('Use another account');
    });

    it('offers to accept, in the person’s language', () => {
        const html = render('ready', {}, 'es');
        expect(html).toContain('Únete a Acme');
        expect(html).toContain('Aceptar invitación');
    });

    it('says so when the link no longer works', () => {
        expect(render('expired')).toContain('This invitation has expired.');
        expect(render('invalid')).toContain('This invitation is no longer valid.');
    });

    it('sends an unverified email to verification', () => {
        expect(render('needs-verification')).toContain('href="/auth/verify-email?next=x"');
    });
});
