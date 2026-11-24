import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { readWebEnv } from './env';

let auth: Auth | null = null;

function firebaseApp(): FirebaseApp {
    if (getApps().length) return getApp();
    return initializeApp(readWebEnv().firebase);
}

/**
 * The Firebase Auth instance, created on first use. Lazy on purpose: modules that import this are also evaluated
 * during the server render, and Auth only does something useful in the browser.
 */
export function firebaseAuth(): Auth {
    if (auth) return auth;
    auth = getAuth(firebaseApp());
    const env = readWebEnv();
    // The Auth emulator `pnpm dev` starts (firebase.json, :9099), or the browser tests' own. Any API key works
    // against it with a `demo-*` project.
    if (env.useFirebaseEmulators) {
        connectAuthEmulator(auth, `http://${env.authEmulatorHost}`, { disableWarnings: true });
    }
    return auth;
}
