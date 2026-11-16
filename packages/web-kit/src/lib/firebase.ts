import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { readWebEnv } from './env';

/** The Auth emulator `pnpm dev` starts (firebase.json). Any API key works against it with a `demo-*` project. */
export const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';

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
    if (readWebEnv().useFirebaseEmulators) {
        connectAuthEmulator(auth, AUTH_EMULATOR_URL, { disableWarnings: true });
    }
    return auth;
}
