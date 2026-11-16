import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { directionOf } from '@app/i18n';
import { I18nProvider } from '@app/i18n/react';
import { AuthProvider } from '@app/web-kit';
import { getI18n } from '@/i18n/server';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getI18n();
    return {
        title: { default: t('common.appName'), template: `%s · ${t('common.appName')}` },
        description: t('common.appDescription'),
    };
}

/**
 * The root: the request's language decides `<html lang>`, the dictionary handed to the client, and everything
 * under it. Only this language's dictionary reaches the browser.
 */
export default async function RootLayout({
    children,
}: {
    readonly children: ReactNode;
}): Promise<ReactNode> {
    const { locale, messages } = await getI18n();
    return (
        <html lang={locale} dir={directionOf(locale)}>
            <body>
                <I18nProvider locale={locale} messages={messages}>
                    <AuthProvider>{children}</AuthProvider>
                </I18nProvider>
            </body>
        </html>
    );
}
