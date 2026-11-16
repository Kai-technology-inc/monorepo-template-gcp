import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { en } from './messages/en';
import { es } from './messages/es';
import { I18nProvider, RichText, useT } from './react';

function Title(): React.ReactNode {
    const t = useT();
    return <h1>{t('auth.login.title')}</h1>;
}

describe('I18nProvider', () => {
    it('renders the active language', () => {
        expect(
            renderToStaticMarkup(
                <I18nProvider locale="es" messages={es}>
                    <Title />
                </I18nProvider>,
            ),
        ).toBe('<h1>Iniciar sesión</h1>');
    });

    it('maps markup tags to components', () => {
        const html = renderToStaticMarkup(
            <I18nProvider locale="en" messages={en}>
                <RichText
                    k="auth.login.noAccount"
                    tags={{ link: (chunk) => <a href="/auth/register">{chunk}</a> }}
                />
            </I18nProvider>,
        );
        expect(html).toBe('Don&#x27;t have an account? <a href="/auth/register">Create one</a>');
    });

    it('fails loudly outside the provider', () => {
        expect(() => renderToStaticMarkup(<Title />)).toThrow(/I18nProvider/);
    });
});
