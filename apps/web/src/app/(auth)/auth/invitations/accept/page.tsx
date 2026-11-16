import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import { AcceptInvitationScreen } from '@app/web-platform';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
    return { title: (await getI18n()).t('invitations.accept.submit') };
}

export default function Page(): ReactNode {
    return (
        <Suspense>
            <AcceptInvitationScreen />
        </Suspense>
    );
}
