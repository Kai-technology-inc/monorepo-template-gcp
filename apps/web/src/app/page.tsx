import Link from 'next/link';
import type { ReactNode } from 'react';
import { ButtonLink, Card, LocaleSwitcher, ROUTES } from '@app/web-kit';
import { getI18n } from '@/i18n/server';

export default async function LandingPage(): Promise<ReactNode> {
    const { t } = await getI18n();
    const features = [
        { title: t('landing.features.authTitle'), body: t('landing.features.authBody') },
        { title: t('landing.features.stackTitle'), body: t('landing.features.stackBody') },
        { title: t('landing.features.qualityTitle'), body: t('landing.features.qualityBody') },
    ];
    return (
        <div className="landing">
            <header className="landing__top">
                <Link href={ROUTES.home} className="brand">
                    {t('common.appName')}
                </Link>
                <div className="ui-row">
                    <LocaleSwitcher />
                    <ButtonLink href={ROUTES.login} variant="ghost">
                        {t('landing.signIn')}
                    </ButtonLink>
                </div>
            </header>
            <main>
                <section className="landing__hero">
                    <h1>{t('landing.title')}</h1>
                    <p>{t('landing.subtitle')}</p>
                    <div className="ui-row">
                        <ButtonLink href={ROUTES.register}>{t('landing.getStarted')}</ButtonLink>
                        <ButtonLink href={ROUTES.login} variant="secondary">
                            {t('landing.signIn')}
                        </ButtonLink>
                    </div>
                </section>
                <section className="landing__features">
                    {features.map((feature) => (
                        <Card key={feature.title} as="article">
                            <h2>{feature.title}</h2>
                            <p>{feature.body}</p>
                        </Card>
                    ))}
                </section>
            </main>
        </div>
    );
}
