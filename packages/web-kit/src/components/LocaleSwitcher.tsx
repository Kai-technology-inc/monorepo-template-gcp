'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { isLocale, LOCALE_NATIVE_NAMES, SUPPORTED_LOCALES } from '@app/i18n';
import { useLocale, useT } from '@app/i18n/react';
import { useAuth } from '../context/AuthContext';
import { writeLocaleCookie } from '../lib/locale-cookie';
import { InlineSelect } from '../ui/Field';

const OPTIONS = SUPPORTED_LOCALES.map((locale) => ({
    value: locale,
    label: LOCALE_NATIVE_NAMES[locale],
}));

/**
 * Signed out, the choice lives in the cookie. Signed in, it is saved to the profile first (so emails and other
 * devices follow it); the session effect then writes the cookie and re-renders.
 */
export function LocaleSwitcher(): ReactNode {
    const t = useT();
    const locale = useLocale();
    const router = useRouter();
    const { status, updateProfile } = useAuth();
    const [busy, setBusy] = useState(false);

    return (
        <InlineSelect
            label={t('locale.label')}
            value={locale}
            disabled={busy}
            options={OPTIONS}
            onChange={async (event) => {
                const next = event.target.value;
                if (!isLocale(next) || next === locale) return;
                setBusy(true);
                try {
                    if (status === 'ready') {
                        await updateProfile({ locale: next });
                    } else {
                        writeLocaleCookie(next);
                        router.refresh();
                    }
                } catch {
                    writeLocaleCookie(next);
                    router.refresh();
                } finally {
                    setBusy(false);
                }
            }}
        />
    );
}
