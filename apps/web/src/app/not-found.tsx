import type { ReactNode } from 'react';
import { ButtonLink, ROUTES } from '@app/web-kit';
import { getI18n } from '@/i18n/server';

export default async function NotFound(): Promise<ReactNode> {
    const { t } = await getI18n();
    return (
        <main className="not-found">
            <h1>{t('notFound.title')}</h1>
            <p>{t('notFound.body')}</p>
            <ButtonLink href={ROUTES.home}>{t('notFound.home')}</ButtonLink>
        </main>
    );
}
