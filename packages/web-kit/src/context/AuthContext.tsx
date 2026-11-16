'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    reload,
    sendEmailVerification,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    updateProfile as firebaseUpdateProfile,
    type User,
} from 'firebase/auth';
import {
    apiRoutes,
    SessionSchema,
    type AcceptInvitationRequest,
    type CreateWorkspaceRequest,
    type Permission,
    type RegisterRequest,
    type Session,
    type SwitchWorkspaceRequest,
    type UpdateProfileRequest,
} from '@app/contracts';
import { useLocale } from '@app/i18n/react';
import { isApiError } from '../lib/api-error';
import { firebaseAuth } from '../lib/firebase';
import { callApi } from '../lib/http-client';
import { readLocaleCookie, writeLocaleCookie } from '../lib/locale-cookie';

/**
 * - `loading`: Firebase has not said yet whether someone is signed in, or the session is being read.
 * - `signed-out`: nobody is signed in.
 * - `unregistered`: a Firebase identity exists but `POST /account/register` never completed for it.
 * - `ready`: signed in with a session (which may still need email verification or a workspace).
 * - `error`: the session could not be read (network, server). `refreshSession()` retries.
 */
export type AuthStatus = 'loading' | 'signed-out' | 'unregistered' | 'ready' | 'error';

export interface RegisterInput {
    readonly displayName: string;
    readonly email: string;
    readonly password: string;
    /** Omitted when joining through an invitation: the person gets a workspace by accepting it. */
    readonly workspaceName?: string;
}

export interface AuthContextValue {
    readonly status: AuthStatus;
    readonly user: User | null;
    readonly session: Session | null;
    readonly error: unknown;
    readonly signIn: (email: string, password: string) => Promise<void>;
    readonly register: (input: RegisterInput) => Promise<Session>;
    /** Finishes a registration whose API call failed after Firebase created the identity. */
    readonly completeRegistration: (input: Omit<RegisterRequest, 'locale'>) => Promise<Session>;
    readonly signOut: () => Promise<void>;
    /** Reads the session again; `forceToken` first refreshes the ID token (e.g. after verifying the email). */
    readonly refreshSession: (options?: {
        readonly forceToken?: boolean;
    }) => Promise<Session | null>;
    readonly sendVerificationEmail: () => Promise<void>;
    /** Reloads the Firebase user (to see `emailVerified` change) and the session with a fresh token. */
    readonly checkEmailVerified: () => Promise<boolean>;
    readonly updateProfile: (input: UpdateProfileRequest) => Promise<Session>;
    readonly switchWorkspace: (
        workspaceId: SwitchWorkspaceRequest['workspaceId'],
    ) => Promise<Session>;
    readonly createWorkspace: (input: CreateWorkspaceRequest) => Promise<Session>;
    readonly acceptInvitation: (
        workspaceId: string,
        invitationId: string,
        input: AcceptInvitationRequest,
    ) => Promise<Session>;
    /** Whether the signed-in person holds `permission` in the active workspace. */
    readonly can: (permission: Permission) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
    const value = useContext(AuthContext);
    if (!value) throw new Error('useAuth() must be used inside <AuthProvider>');
    return value;
}

/** Whether this session must verify its email before using the app. */
export function needsEmailVerification(session: Session | null): boolean {
    return !!session && session.emailVerificationRequired && !session.emailVerified;
}

export function sessionCan(session: Session | null, permission: Permission): boolean {
    return !!session && session.permissions.includes(permission);
}

/**
 * THE SESSION
 *
 * Firebase owns the identity (who signed in); the API owns the session (profile, active workspace, role,
 * permissions). This provider joins the two: on every identity change it reads `GET /account/session`, and every
 * operation that changes the session answers with the new one, so the screens never have to re-fetch it.
 *
 * It also keeps the language in step: the profile's locale wins, and when it differs from the cookie the server
 * rendered with, the cookie is rewritten and the page re-rendered in the right language.
 */
export function AuthProvider({ children }: { readonly children: ReactNode }): ReactNode {
    const router = useRouter();
    const locale = useLocale();
    const [status, setStatus] = useState<AuthStatus>('loading');
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [error, setError] = useState<unknown>(null);
    /** While registering, the identity exists before the profile: don't read the session in between. */
    const registering = useRef(false);

    const applySession = useCallback((next: Session) => {
        setSession(next);
        setStatus('ready');
        setError(null);
        return next;
    }, []);

    const loadSession = useCallback(async (): Promise<Session | null> => {
        try {
            return applySession(
                await callApi(apiRoutes.account.session(), { schema: SessionSchema }),
            );
        } catch (caught) {
            setSession(null);
            if (isApiError(caught, 'NOT_REGISTERED')) {
                setStatus('unregistered');
                setError(null);
            } else if (isApiError(caught, 'UNAUTHENTICATED')) {
                await firebaseSignOut(firebaseAuth());
            } else {
                setStatus('error');
                setError(caught);
            }
            return null;
        }
    }, [applySession]);

    useEffect(() => {
        return onAuthStateChanged(firebaseAuth(), (next) => {
            setUser(next);
            if (!next) {
                setSession(null);
                setStatus('signed-out');
                return;
            }
            if (registering.current) return;
            setStatus('loading');
            void loadSession();
        });
    }, [loadSession]);

    // Firebase sends its emails (verification, password reset) in this language.
    useEffect(() => {
        firebaseAuth().languageCode = locale;
    }, [locale]);

    // The profile's language wins over the cookie the page was rendered with.
    const profileLocale = session?.user.locale;
    useEffect(() => {
        if (profileLocale && (profileLocale !== locale || readLocaleCookie() !== profileLocale)) {
            writeLocaleCookie(profileLocale);
            if (profileLocale !== locale) router.refresh();
        }
    }, [profileLocale, locale, router]);

    const value = useMemo<AuthContextValue>(() => {
        const postSession = async (path: string, method: 'POST' | 'PUT' | 'PATCH', body: unknown) =>
            applySession(await callApi(path, { method, body, schema: SessionSchema }));

        const register = async (input: Omit<RegisterRequest, 'locale'>): Promise<Session> => {
            const request: RegisterRequest = { ...input, locale };
            const next = await postSession(apiRoutes.account.register(), 'POST', request);
            const current = firebaseAuth().currentUser;
            if (current && next.emailVerificationRequired && !next.emailVerified) {
                await sendEmailVerification(current);
            }
            return next;
        };

        return {
            status,
            user,
            session,
            error,
            signIn: async (email, password) => {
                await signInWithEmailAndPassword(firebaseAuth(), email, password);
            },
            register: async ({ displayName, email, password, workspaceName }) => {
                registering.current = true;
                try {
                    const credential = await createUserWithEmailAndPassword(
                        firebaseAuth(),
                        email,
                        password,
                    );
                    await firebaseUpdateProfile(credential.user, { displayName });
                    setUser(credential.user);
                    try {
                        return await register({
                            displayName,
                            ...(workspaceName ? { workspaceName } : {}),
                        });
                    } catch (caught) {
                        setStatus('unregistered');
                        throw caught;
                    }
                } finally {
                    registering.current = false;
                }
            },
            completeRegistration: (input) => register(input),
            signOut: async () => {
                await firebaseSignOut(firebaseAuth());
                router.refresh();
            },
            refreshSession: async (options) => {
                const current = firebaseAuth().currentUser;
                if (!current) return null;
                if (options?.forceToken) await current.getIdToken(true);
                return loadSession();
            },
            sendVerificationEmail: async () => {
                const current = firebaseAuth().currentUser;
                if (current) await sendEmailVerification(current);
            },
            checkEmailVerified: async () => {
                const current = firebaseAuth().currentUser;
                if (!current) return false;
                await reload(current);
                await current.getIdToken(true);
                const next = await loadSession();
                return !!next?.emailVerified;
            },
            updateProfile: (input) => postSession(apiRoutes.account.profile(), 'PATCH', input),
            switchWorkspace: (workspaceId) =>
                postSession(apiRoutes.account.activeWorkspace(), 'PUT', { workspaceId }),
            createWorkspace: (input) => postSession(apiRoutes.workspaces.create(), 'POST', input),
            acceptInvitation: (workspaceId, invitationId, input) =>
                postSession(
                    apiRoutes.workspaces.acceptInvitation(workspaceId, invitationId),
                    'POST',
                    input,
                ),
            can: (permission) => sessionCan(session, permission),
        };
    }, [status, user, session, error, locale, router, applySession, loadSession]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
