import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';
import { ForgotPasswordForm } from '@app/web-platform';
import { getI18n } from '@/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
    return { title: (await getI18n()).t('auth.forgot.title') };
}

export default function Page(): ReactNode {
    return (
        <Suspense>
            <ForgotPasswordForm />
        </Suspense>
    );
}
