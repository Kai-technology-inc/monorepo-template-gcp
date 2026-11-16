#!/usr/bin/env node
// Connects the web to the rest once its App Hosting backend exists. Idempotent.
//
//   pnpm setup:web <qa|prod>
//
//   1. Sets the backend's environment name to <env>, so builds read apps/web/apphosting.<env>.yaml.
//   2. Turns automatic rollouts off: deploys come from tags (docs/DEPLOY.md).
//   3. Adds the web origin to the GitHub variable <ENV>_ALLOWED_ORIGINS (the API's CORS list).
//   4. Adds the web domain to Firebase Auth's authorized domains.
//   5. Points Auth emails (verification, password reset) at <origin>/auth/action.
//
// Reads APPHOSTING_BACKEND_ID (default "web"). Each step that fails says how to do it by hand.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENVIRONMENT = process.argv[2]?.toLowerCase();
if (!['qa', 'prod'].includes(ENVIRONMENT)) {
    console.error('Usage: pnpm setup:web <qa|prod>');
    process.exit(2);
}
const ENV_UPPER = ENVIRONMENT.toUpperCase();
const BACKEND_ID = process.env.APPHOSTING_BACKEND_ID || 'web';
const sh = (command, args) =>
    execFileSync(command, args, {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
const ok = (text) => console.log(`  \x1b[32m✓\x1b[0m ${text}`);
let failures = 0;
const warn = (text) => {
    failures += 1;
    console.error(`  \x1b[33m!\x1b[0m ${text}`);
};

const project = JSON.parse(readFileSync(join(ROOT, '.firebaserc'), 'utf8')).projects?.[ENVIRONMENT];
if (!project) {
    console.error(`No project for ${ENVIRONMENT} in .firebaserc. Run pnpm setup:gcp first.`);
    process.exit(1);
}
const token = sh('gcloud', ['auth', 'print-access-token']);
async function api(method, url, body) {
    const response = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'x-goog-user-project': project,
            'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const json = await response.json().catch(() => null);
    if (!response.ok) throw new Error(`${response.status} ${json?.error?.message ?? ''}`.trim());
    return json;
}

console.log(`\n\x1b[1mConnecting the web of ${project} (${ENVIRONMENT})\x1b[0m`);
const APPHOSTING = 'https://firebaseapphosting.googleapis.com/v1beta';
const { backends = [] } = await api(
    'GET',
    `${APPHOSTING}/projects/${project}/locations/-/backends`,
);
const backend = backends.find((b) => b.name.endsWith(`/backends/${BACKEND_ID}`));
if (!backend) {
    console.error(
        `No App Hosting backend "${BACKEND_ID}" in ${project}. Create it first (docs/DEPLOY.md, step 2):\n` +
            `  pnpm exec firebase apphosting:backends:create --project ${project} --backend ${BACKEND_ID} --primary-region us-central1 --root-dir apps/web`,
    );
    process.exit(1);
}
const consoleUrl = `https://console.firebase.google.com/project/${project}/apphosting`;

try {
    if (backend.environment !== ENVIRONMENT) {
        await api('PATCH', `${APPHOSTING}/${backend.name}?updateMask=environment`, {
            environment: ENVIRONMENT,
        });
    }
    ok(`Backend environment name: ${ENVIRONMENT}`);
} catch (error) {
    warn(
        `Could not set the environment name (${error.message}). Console: ${consoleUrl} → ${BACKEND_ID} → Settings → Environment → "${ENVIRONMENT}".`,
    );
}

try {
    await api('PATCH', `${APPHOSTING}/${backend.name}/traffic?updateMask=rolloutPolicy.disabled`, {
        rolloutPolicy: { disabled: true },
    });
    ok('Automatic rollouts off');
} catch (error) {
    warn(
        `Could not turn automatic rollouts off (${error.message}). Console: ${consoleUrl} → ${BACKEND_ID} → Settings → Deployment.`,
    );
}

if (!backend.uri) {
    console.error('The backend has no URL yet. Wait a minute and run this again.');
    process.exit(1);
}
const origin = `https://${backend.uri.replace(/^https?:\/\//, '')}`;
const host = new URL(origin).host;

const remote = sh('git', ['remote', 'get-url', 'origin']);
const repository = remote.match(/github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/)?.[1];
const variable = `${ENV_UPPER}_ALLOWED_ORIGINS`;
try {
    const current = JSON.parse(
        sh('gh', ['variable', 'list', '--repo', repository, '--json', 'name,value']),
    ).find((v) => v.name === variable)?.value;
    const origins = new Set(
        (current ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
    );
    origins.add(origin);
    sh('gh', ['variable', 'set', variable, '--repo', repository, '--body', [...origins].join(',')]);
    ok(`${variable} = ${[...origins].join(',')}`);
} catch (error) {
    warn(
        `Could not set ${variable} (${error.message.split('\n')[0]}). Run: gh variable set ${variable} --body "${origin}"`,
    );
}

const IDENTITY = `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`;
try {
    const config = await api('GET', IDENTITY);
    const domains = new Set(config.authorizedDomains ?? []);
    domains.add(host);
    const sendEmail = {
        ...(config.notification?.sendEmail ?? {}),
        callbackUri: `${origin}/auth/action`,
    };
    await api(
        'PATCH',
        `${IDENTITY}?updateMask=authorizedDomains,notification.sendEmail.callbackUri`,
        {
            authorizedDomains: [...domains],
            notification: { sendEmail },
        },
    );
    ok(`Auth authorized domain: ${host}`);
    ok(`Auth email action URL: ${origin}/auth/action`);
} catch (error) {
    warn(
        `Could not update Firebase Auth (${error.message}). Console: https://console.firebase.google.com/project/${project}/authentication/settings ` +
            `→ Authorized domains: add ${host}; Templates → Customize action URL: ${origin}/auth/action.`,
    );
}

console.log(
    failures
        ? `\n${failures} step(s) need the console (above). Then: pnpm doctor ${ENVIRONMENT}\n`
        : `\nDone. The web origin is ${origin}. If the API is already deployed, redeploy it so CORS picks up the origin.\n`,
);
process.exit(failures ? 1 : 0);
