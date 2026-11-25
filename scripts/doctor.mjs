#!/usr/bin/env node
// Where is this repository in its setup, and what is the next step? Read-only: it never changes anything.
//
//   pnpm run doctor              local development only
//   pnpm run doctor qa           + everything the qa environment needs, in order
//   pnpm run doctor prod --json  machine-readable, for coding agents (see docs/ONBOARDING.md)
//
// Every step has an `owner`: `agent` means a coding agent (or you) can do it from a terminal with the command in
// `next`; `human` means it needs a person: a login, a browser, a payment method or a decision.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const JSON_OUTPUT = args.includes('--json');
const ENVIRONMENT = args.find((a) => !a.startsWith('--'))?.toLowerCase();
if (ENVIRONMENT && !['qa', 'prod'].includes(ENVIRONMENT)) {
    console.error(`Environment must be qa or prod, got "${ENVIRONMENT}".`);
    process.exit(2);
}
const ENV_UPPER = ENVIRONMENT?.toUpperCase();
const BACKEND_ID = process.env.APPHOSTING_BACKEND_ID || 'web';
const FIREBASE = join(ROOT, 'node_modules', '.bin', 'firebase');

/** Runs a command; never throws. */
function run(command, commandArgs, timeout = 60_000) {
    try {
        const out = execFileSync(command, commandArgs, {
            cwd: ROOT,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout,
        });
        return { ok: true, out: out.trim() };
    } catch (error) {
        return { ok: false, out: `${error.stdout ?? ''}${error.stderr ?? ''}`.trim() };
    }
}
const has = (command) => run('sh', ['-c', `command -v ${command}`]).ok;

async function googleApi(url, project, token) {
    try {
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}`, 'x-goog-user-project': project },
        });
        return { status: response.status, body: response.ok ? await response.json() : null };
    } catch {
        return { status: 0, body: null };
    }
}
async function httpStatus(url) {
    try {
        return (await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000) }))
            .status;
    } catch {
        return 0;
    }
}

const steps = [];
let blocked = false; // once a step is not done, the steps that depend on it are reported as blocked
function step(id, title, owner, done, next, detail) {
    const status = done ? 'ok' : blocked ? 'blocked' : 'todo';
    steps.push({
        id,
        title,
        owner,
        status,
        ...(done ? {} : { next }),
        ...(detail ? { detail } : {}),
    });
    return done;
}
/** A step later steps depend on. */
function gate(...stepArgs) {
    const done = step(...stepArgs);
    if (!done) blocked = true;
    return done;
}

// ── Local development ────────────────────────────────────────────────────────────────────────────────────────────
step(
    'plan',
    'Project described and plan confirmed (PROJECT.md)',
    'agent',
    existsSync(join(ROOT, 'PROJECT.md')),
    'Interview the person and get the plan confirmed before creating anything: docs/ONBOARDING.md, phase 1.',
);
// `java -version` prints to stderr: 'openjdk version "21.0.4"' (or "1.8.0_x" for Java 8).
const javaVersion = run('sh', ['-c', 'java -version 2>&1']).out.match(/version "(\d+)(?:\.(\d+))?/);
const javaMajor = javaVersion
    ? javaVersion[1] === '1'
        ? Number(javaVersion[2])
        : Number(javaVersion[1])
    : 0;
// Homebrew's openjdk@21 is keg-only: installed, but neither on the PATH nor in /usr/libexec/java_home.
const kegJava =
    javaMajor >= 21
        ? null
        : (['/opt/homebrew/opt/openjdk@21', '/usr/local/opt/openjdk@21'].find((dir) =>
              existsSync(join(dir, 'bin', 'java')),
          ) ?? null);
const nodeMajor = Number(process.versions.node.split('.')[0]);
gate(
    'node',
    'Node.js 22+',
    'human',
    nodeMajor >= 22,
    'Install Node 22 (https://nodejs.org or `nvm install`).',
    `found ${process.versions.node}`,
);
gate('pnpm', 'pnpm 12', 'human', has('pnpm'), 'npm install -g pnpm');
step(
    'java',
    'Java 21+ (Firebase emulators)',
    'human',
    javaMajor >= 21,
    kegJava
        ? `Java 21 is installed but is not the default: \`export JAVA_HOME=${kegJava} PATH="${kegJava}/bin:$PATH"\` before \`pnpm dev\` (or link it: \`sudo ln -sfn ${kegJava}/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-21.jdk\`).`
        : 'Install a JDK 21+ (e.g. `brew install openjdk@21`, or https://adoptium.net), needed by `pnpm dev`.',
);
gate(
    'dependencies',
    'Dependencies installed',
    'agent',
    existsSync(join(ROOT, 'node_modules', '.pnpm')),
    'pnpm install',
);
const gitRepo = run('git', ['rev-parse', '--is-inside-work-tree']).ok;
const hasCommit = gitRepo && run('git', ['rev-parse', 'HEAD']).ok;
step(
    'git',
    'Git repository with a first commit',
    'agent',
    hasCommit,
    'git init -b main && git add -A && git commit -m "chore: start from template"',
);

let project;
let repository;
let firestoreRegion = null;
if (ENVIRONMENT) {
    // ── Tools and logins ─────────────────────────────────────────────────────────────────────────────────────────
    gate(
        'gcloud',
        'Google Cloud CLI installed',
        'human',
        has('gcloud'),
        'Install it: https://cloud.google.com/sdk/docs/install (or use Google Cloud Shell, where it is ready).',
    );
    const account = has('gcloud') ? run('gcloud', ['config', 'get-value', 'account']).out : '';
    gate(
        'gcloud-login',
        'Logged in to Google Cloud',
        'human',
        /@/.test(account),
        'gcloud auth login',
        account || undefined,
    );
    gate(
        'firebase-login',
        'Logged in to Firebase CLI',
        'human',
        /@/.test(run(FIREBASE, ['login:list']).out),
        'pnpm exec firebase login',
    );
    gate(
        'gh',
        'GitHub CLI installed and logged in',
        'human',
        has('gh') && run('gh', ['auth', 'status']).ok,
        has('gh') ? 'gh auth login' : 'Install it: https://cli.github.com, then `gh auth login`.',
    );

    // ── GitHub repository ────────────────────────────────────────────────────────────────────────────────────────
    const remote = run('git', ['remote', 'get-url', 'origin']).out;
    repository = remote.match(/github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/)?.[1];
    // A clone of the template itself still points origin at the template: deploying from it would configure CI for
    // someone else's repository. Same if the person cannot administer origin (variables, environments need admin).
    const viewed =
        repository &&
        run('gh', ['repo', 'view', repository, '--json', 'isTemplate,viewerPermission']);
    const info = viewed?.ok ? JSON.parse(viewed.out) : undefined;
    const ownRepository = Boolean(info && !info.isTemplate && info.viewerPermission === 'ADMIN');
    const createCommand =
        'Ask for owner/name and visibility, then: gh repo create <owner>/<name> --private --source . --remote origin --push';
    gate(
        'github-repo',
        'Your own repository on GitHub (origin)',
        'agent',
        ownRepository && hasCommit,
        info?.isTemplate || (info && info.viewerPermission !== 'ADMIN')
            ? `origin is ${info.isTemplate ? 'the template' : 'a repository you do not administer'} (${repository}). Keep it for template updates and create yours: git remote rename origin template && ${createCommand.replace('Ask for owner/name and visibility, then: ', '')} (ask owner/name and visibility first)`
            : createCommand,
        repository,
    );
    if (info && !ownRepository) repository = undefined;

    // ── Google Cloud project ─────────────────────────────────────────────────────────────────────────────────────
    let rc = {};
    try {
        rc = JSON.parse(readFileSync(join(ROOT, '.firebaserc'), 'utf8'));
    } catch {}
    project = rc.projects?.[ENVIRONMENT];
    const setupCommand = `pnpm setup:gcp ${project ?? '<project-id>'} ${ENVIRONMENT} --create --github ${repository ?? '<owner/repo>'}`;
    gate(
        'project-alias',
        `Project chosen for ${ENVIRONMENT} (.firebaserc)`,
        'agent',
        Boolean(project),
        `Ask for the project id (e.g. my-app-${ENVIRONMENT}; globally unique), then: ${setupCommand}`,
        project,
    );
    const described =
        !blocked &&
        run('gcloud', ['projects', 'describe', project, '--format=value(projectNumber)']);
    gate(
        'project',
        'Project exists and you can see it',
        'agent',
        Boolean(described?.ok),
        setupCommand,
    );
    const billing =
        !blocked &&
        run('gcloud', [
            'billing',
            'projects',
            'describe',
            project,
            '--format=value(billingEnabled)',
        ]).out;
    gate(
        'billing',
        'Billing linked (Blaze plan)',
        'human',
        billing === 'True',
        `Pick a billing account: \`gcloud billing accounts list\`, then with the person's OK: \`gcloud billing projects link ${project ?? '<project-id>'} --billing-account <ID>\`. No account yet: https://console.cloud.google.com/billing/linkedaccount?project=${project ?? '<project-id>'}`,
    );
    const firestoreDescribed = blocked
        ? { ok: false, out: '' }
        : run('gcloud', [
              'firestore',
              'databases',
              'describe',
              '--database=(default)',
              `--project=${project}`,
              '--format=value(locationId)',
          ]);
    const firestore = firestoreDescribed.ok;
    // App Hosting goes where the database is: a web in another region pays the round trip on every request.
    firestoreRegion = firestore ? firestoreDescribed.out.trim() || null : null;
    gate(
        'firestore',
        'APIs, Firestore, Auth and web app configured',
        'agent',
        firestore,
        setupCommand,
    );
    const configFile = join(ROOT, 'apps', 'web', `apphosting.${ENVIRONMENT}.yaml`);
    const config = existsSync(configFile) ? readFileSync(configFile, 'utf8') : 'REPLACE_ME';
    gate(
        'apphosting-config',
        `apps/web/apphosting.${ENVIRONMENT}.yaml generated`,
        'agent',
        !config.includes('REPLACE_ME'),
        setupCommand,
    );
    const committed =
        !blocked &&
        run('git', ['diff', '--quiet', 'HEAD', '--', '.firebaserc', configFile]).ok &&
        run('git', ['ls-files', '--error-unmatch', configFile]).ok;
    step(
        'config-committed',
        'Generated config committed and pushed',
        'agent',
        committed,
        `git add .firebaserc apps/web/apphosting.${ENVIRONMENT}.yaml && git commit -m "chore: ${ENVIRONMENT} environment" && git push`,
    );

    // ── GitHub Actions ───────────────────────────────────────────────────────────────────────────────────────────
    const variables = !blocked
        ? run('gh', ['variable', 'list', '--repo', repository, '--json', 'name,value'])
        : { ok: false };
    const vars = Object.fromEntries(
        (variables.ok ? JSON.parse(variables.out || '[]') : []).map((v) => [v.name, v.value]),
    );
    gate(
        'wif',
        'GitHub → GCP without keys (Workload Identity Federation)',
        'agent',
        Boolean(vars[`${ENV_UPPER}_WIF_PROVIDER`] && vars[`${ENV_UPPER}_FIREBASE_PROJECT_NUMBER`]),
        setupCommand,
    );
    const environmentApi =
        !blocked && run('gh', ['api', `repos/${repository}/environments/${ENVIRONMENT}`]);
    step(
        'github-environment',
        `GitHub environment "${ENVIRONMENT}"`,
        'agent',
        Boolean(environmentApi?.ok),
        `bash scripts/configure-wif.sh ${project} ${ENVIRONMENT} ${repository}`,
    );
    if (ENVIRONMENT === 'prod' && environmentApi?.ok) {
        const rules = JSON.parse(environmentApi.out).protection_rules ?? [];
        step(
            'prod-reviewers',
            'Production deploys need an approval',
            'human',
            rules.some((r) => r.type === 'required_reviewers'),
            `Ask who approves production deploys, then: https://github.com/${repository}/settings/environments (prod → Required reviewers). Private repos need a paid GitHub plan for this.`,
        );
    }

    // ── App Hosting and Auth ─────────────────────────────────────────────────────────────────────────────────────
    const token = !blocked ? run('gcloud', ['auth', 'print-access-token']).out : '';
    const backends = !blocked
        ? await googleApi(
              `https://firebaseapphosting.googleapis.com/v1beta/projects/${project}/locations/-/backends`,
              project,
              token,
          )
        : { body: null };
    const backend = backends.body?.backends?.find((b) =>
        b.name.endsWith(`/backends/${BACKEND_ID}`),
    );
    gate(
        'apphosting-backend',
        `App Hosting backend "${BACKEND_ID}" connected to GitHub`,
        'human',
        Boolean(backend?.codebase?.repository),
        `In a terminal (interactive, opens GitHub in the browser): pnpm exec firebase apphosting:backends:create --project ${project ?? '<project-id>'} --backend ${BACKEND_ID} --primary-region ${firestoreRegion ?? 'us-central1'} --root-dir apps/web — or the console: https://console.firebase.google.com/project/${project ?? '<project-id>'}/apphosting. Repository: ${repository}, root directory: apps/web, live branch: main.`,
    );
    const origin = backend?.uri ? `https://${backend.uri.replace(/^https?:\/\//, '')}` : undefined;
    let trafficDisabled = false;
    if (backend) {
        const traffic = await googleApi(
            `https://firebaseapphosting.googleapis.com/v1beta/${backend.name}/traffic`,
            project,
            token,
        );
        trafficDisabled =
            traffic.body?.rolloutPolicy?.disabled === true ||
            !traffic.body?.rolloutPolicy?.codebaseBranch;
    }
    const connectCommand = `pnpm setup:web ${ENVIRONMENT}`;
    step(
        'backend-settings',
        `Backend reads apphosting.${ENVIRONMENT}.yaml; automatic rollouts off`,
        'agent',
        backend?.environment === ENVIRONMENT && trafficDisabled,
        connectCommand,
        backend ? `environment=${backend.environment ?? '(none)'}` : undefined,
    );
    const allowed = (vars[`${ENV_UPPER}_ALLOWED_ORIGINS`] ?? '').split(',').map((s) => s.trim());
    step(
        'allowed-origins',
        `API allows the web origin (${ENV_UPPER}_ALLOWED_ORIGINS)`,
        'agent',
        Boolean(origin && allowed.includes(origin)),
        connectCommand,
        origin,
    );
    const authConfig = !blocked
        ? await googleApi(
              `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`,
              project,
              token,
          )
        : { body: null };
    const host = origin && new URL(origin).host;
    step(
        'auth-domain',
        'Firebase Auth trusts the web domain',
        'agent',
        Boolean(host && authConfig.body?.authorizedDomains?.includes(host)),
        connectCommand,
    );
    step(
        'auth-action-url',
        'Auth emails link to the web (/auth/action)',
        'agent',
        Boolean(
            origin &&
            authConfig.body?.notification?.sendEmail?.callbackUri === `${origin}/auth/action`,
        ),
        connectCommand,
    );

    // ── Deployed ─────────────────────────────────────────────────────────────────────────────────────────────────
    // Either quote: prettier writes the generated YAML with single quotes.
    const apiBase = config.match(/NEXT_PUBLIC_API_BASE_URL\s*\n\s*value:\s*["']([^"']+)["']/)?.[1];
    const apiHealth = !blocked && apiBase ? await httpStatus(`${apiBase}/account/health`) : 0;
    const deployCommand =
        ENVIRONMENT === 'qa'
            ? "Commit and push everything, run `pnpm check`, then with the person's OK: `pnpm create-version --yes` (tags rcX.Y.Z → GitHub Actions deploys QA). Watch it: `gh run watch`."
            : 'A person publishes a release of a version already in QA: `gh release create vX.Y.Z --target rcX.Y.Z --generate-notes`, then approves the deploy in GitHub Actions.';
    step(
        'api-deployed',
        'API deployed and healthy',
        ENVIRONMENT === 'qa' ? 'agent' : 'human',
        apiHealth === 200,
        deployCommand,
        apiBase ? `${apiBase}/account/health → ${apiHealth || 'no answer'}` : undefined,
    );
    const webStatus = !blocked && origin ? await httpStatus(`${origin}/health`) : 0;
    step(
        'web-deployed',
        'Web deployed',
        ENVIRONMENT === 'qa' ? 'agent' : 'human',
        webStatus === 200,
        deployCommand,
        origin ? `${origin}/health → ${webStatus || 'no answer'}` : undefined,
    );
}

// ── Report ───────────────────────────────────────────────────────────────────────────────────────────────────────
const next = steps.find((s) => s.status === 'todo');
const report = {
    environment: ENVIRONMENT ?? 'local',
    project,
    repository,
    done: !next,
    next,
    steps,
};
if (JSON_OUTPUT) {
    console.log(JSON.stringify(report, null, 2));
} else {
    const icon = { ok: '\x1b[32m✓\x1b[0m', todo: '\x1b[33m○\x1b[0m', blocked: '\x1b[90m·\x1b[0m' };
    console.log(
        `\n\x1b[1mSetup status: ${report.environment}${project ? ` (${project})` : ''}\x1b[0m\n`,
    );
    for (const s of steps) {
        const who = s.status === 'ok' ? '' : ` \x1b[90m[${s.owner}]\x1b[0m`;
        console.log(
            `  ${icon[s.status]} ${s.title}${who}${s.detail ? ` \x1b[90m${s.detail}\x1b[0m` : ''}`,
        );
    }
    if (next) {
        console.log(`\n\x1b[1mNext (${next.owner}):\x1b[0m ${next.title}\n  ${next.next}\n`);
    } else {
        console.log(
            `\n\x1b[32mAll done.\x1b[0m${ENVIRONMENT ? '' : ' Run `pnpm run doctor qa` to go to Google Cloud.'}\n`,
        );
    }
}
