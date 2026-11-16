'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { apiRoutes, WorkspaceSchema, type Locale } from '@app/contracts';
import { isLocale, LOCALE_NATIVE_NAMES, SUPPORTED_LOCALES } from '@app/i18n';
import { useT } from '@app/i18n/react';
import {
    Alert,
    Button,
    callApi,
    Card,
    DEFAULT_SIGNED_IN_ROUTE,
    SelectField,
    TextField,
    useAuth,
    useErrorMessage,
} from '@app/web-kit';

type Notice = { readonly tone: 'success' | 'error'; readonly text: string } | null;

export function SettingsScreen(): ReactNode {
    const t = useT();
    const { session } = useAuth();
    if (!session) return null;
    return (
        <div className="ui-stack">
            <h1 className="page-title">{t('settings.title')}</h1>
            {session.workspace ? null : <Alert tone="info">{t('workspace.none')}</Alert>}
            <ProfileCard />
            {session.workspace ? <WorkspaceCard /> : null}
            <NewWorkspaceCard />
        </div>
    );
}

function ProfileCard(): ReactNode {
    const t = useT();
    const { session, updateProfile } = useAuth();
    const errorMessage = useErrorMessage();
    const [displayName, setDisplayName] = useState(session?.user.displayName ?? '');
    const [locale, setLocale] = useState<Locale>(session?.user.locale ?? 'en');
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<Notice>(null);

    return (
        <Card title={t('settings.profile.title')}>
            <form
                className="ui-stack"
                onSubmit={async (event) => {
                    event.preventDefault();
                    setBusy(true);
                    setNotice(null);
                    try {
                        await updateProfile({ displayName: displayName.trim(), locale });
                        setNotice({ tone: 'success', text: t('settings.profile.saved') });
                    } catch (caught) {
                        setNotice({ tone: 'error', text: errorMessage(caught) });
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
                <TextField
                    label={t('settings.profile.displayName')}
                    autoComplete="name"
                    required
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                />
                <SelectField
                    label={t('settings.profile.language')}
                    hint={t('settings.profile.languageHint')}
                    value={locale}
                    options={SUPPORTED_LOCALES.map((value) => ({
                        value,
                        label: LOCALE_NATIVE_NAMES[value],
                    }))}
                    onChange={(event) =>
                        isLocale(event.target.value) && setLocale(event.target.value)
                    }
                />
                <div>
                    <Button type="submit" busy={busy}>
                        {busy ? t('common.saving') : t('common.save')}
                    </Button>
                </div>
            </form>
        </Card>
    );
}

function WorkspaceCard(): ReactNode {
    const t = useT();
    const { session, can, refreshSession } = useAuth();
    const errorMessage = useErrorMessage();
    const workspace = session?.workspace;
    const [name, setName] = useState(workspace?.name ?? '');
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState<Notice>(null);
    if (!workspace) return null;
    const editable = can('workspace:update');

    return (
        <Card title={t('settings.workspace.title')}>
            <form
                className="ui-stack"
                onSubmit={async (event) => {
                    event.preventDefault();
                    setBusy(true);
                    setNotice(null);
                    try {
                        await callApi(apiRoutes.workspaces.one(workspace.id), {
                            method: 'PATCH',
                            body: { name: name.trim() },
                            schema: WorkspaceSchema,
                        });
                        await refreshSession();
                        setNotice({ tone: 'success', text: t('settings.workspace.saved') });
                    } catch (caught) {
                        setNotice({ tone: 'error', text: errorMessage(caught) });
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                {notice ? <Alert tone={notice.tone}>{notice.text}</Alert> : null}
                {editable ? null : <Alert tone="info">{t('settings.workspace.readOnly')}</Alert>}
                <TextField
                    label={t('settings.workspace.name')}
                    required
                    readOnly={!editable}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                />
                <TextField label={t('settings.workspace.slug')} readOnly value={workspace.slug} />
                {editable ? (
                    <div>
                        <Button type="submit" busy={busy}>
                            {busy ? t('common.saving') : t('common.save')}
                        </Button>
                    </div>
                ) : null}
            </form>
        </Card>
    );
}

function NewWorkspaceCard(): ReactNode {
    const t = useT();
    const router = useRouter();
    const { createWorkspace } = useAuth();
    const errorMessage = useErrorMessage();
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    return (
        <Card title={t('settings.newWorkspace.title')}>
            <form
                id="new-workspace"
                className="ui-stack"
                onSubmit={async (event) => {
                    event.preventDefault();
                    setBusy(true);
                    setError(null);
                    try {
                        await createWorkspace({ name: name.trim() });
                        router.push(DEFAULT_SIGNED_IN_ROUTE);
                    } catch (caught) {
                        setError(errorMessage(caught));
                        setBusy(false);
                    }
                }}
            >
                <p className="muted">{t('settings.newWorkspace.body')}</p>
                {error ? <Alert tone="error">{error}</Alert> : null}
                <TextField
                    label={t('settings.newWorkspace.name')}
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                />
                <div>
                    <Button type="submit" busy={busy}>
                        {busy
                            ? t('settings.newWorkspace.submitting')
                            : t('settings.newWorkspace.submit')}
                    </Button>
                </div>
            </form>
        </Card>
    );
}
