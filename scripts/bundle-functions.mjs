#!/usr/bin/env node
/**
 * BUNDLES THE FUNCTIONS CODEBASE INTO ONE FILE
 *
 * Runs from `apps/functions` (its `bundle:functions` script) after `tsc -b` emitted `dist/` with the decorator
 * metadata Nest needs (esbuild does not emit it, which is why the bundle starts from the emitted JS and not from the
 * TypeScript). esbuild joins `dist/index.js` and everything it imports, workspace packages included, into
 * `.functions/index.js`, and writes next to it a `package.json` with only the dependencies left outside: what Cloud
 * Build installs.
 *
 * What stays external:
 * - `firebase-admin`, `firebase-functions` and `@google-cloud/*`: the runtime expects them as packages
 *   (firebase-functions discovers the Functions through `main`, and the Google clients carry protos and gRPC).
 * - Any `require` esbuild cannot resolve (Nest's optional peers: `@nestjs/microservices`, `class-validator`…):
 *   marked external and NOT added to package.json, because Nest wraps them in try/catch.
 *
 * `.functions/` is not wiped: the deploy writes its `.env` there and the emulator reads `.secret.local`.
 *
 *   node scripts/bundle-functions.mjs            writes .functions/ and links node_modules (for the emulator)
 *   node scripts/bundle-functions.mjs --no-link  no link: the deploy installs the externals
 */
import {
    existsSync,
    lstatSync,
    mkdirSync,
    readFileSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { builtinModules, createRequire } from 'node:module';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, '.functions');
const entry = path.join(root, 'dist/index.js');
const require = createRequire(path.join(root, 'package.json'));
const { build } = require('esbuild');
const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

if (manifest.name !== '@app/functions') {
    console.error(`${root} is not the Functions codebase (apps/functions): run it from there.`);
    process.exit(1);
}
if (!existsSync(entry)) {
    console.error(`Missing ${entry}: build first (pnpm turbo run build --filter=@app/functions).`);
    process.exit(1);
}

const KEEP_EXTERNAL = ['firebase-admin', 'firebase-functions', '@google-cloud/*'];

const unresolved = new Set();
const externals = {
    name: 'externals',
    setup(api) {
        api.onResolve({ filter: /^[^./]/ }, (args) => {
            if (args.kind === 'entry-point') return null;
            const name = packageNameOf(args.path);
            if (isBuiltin(name)) return { path: args.path, external: true };
            if (KEEP_EXTERNAL.some((pattern) => matches(pattern, name)))
                return { path: args.path, external: true };
            try {
                require.resolve(args.path, { paths: [args.resolveDir] });
                return null;
            } catch {
                unresolved.add(args.path);
                return { path: args.path, external: true };
            }
        });
    },
};

function packageNameOf(specifier) {
    const parts = specifier.split('/');
    return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}
function matches(pattern, name) {
    return pattern.endsWith('/*') ? name.startsWith(pattern.slice(0, -1)) : pattern === name;
}
function isBuiltin(name) {
    return name.startsWith('node:') || builtinModules.includes(name);
}

mkdirSync(out, { recursive: true });
for (const stale of ['index.js', 'index.js.map', 'package.json', 'meta.json']) {
    rmSync(path.join(out, stale), { force: true });
}

const started = Date.now();
const result = await build({
    entryPoints: [entry],
    outfile: path.join(out, 'index.js'),
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    sourcemap: true,
    minify: false,
    keepNames: true,
    metafile: true,
    logLevel: 'warning',
    plugins: [externals],
    // NestJS (12+) ships as ESM and calls `createRequire(import.meta.url)`; in a CommonJS bundle `import.meta` is
    // empty, so it points at the bundle file instead (what it requires through it resolves from its node_modules).
    define: { 'import.meta.url': '__bundleFileUrl' },
    banner: { js: "const __bundleFileUrl = require('node:url').pathToFileURL(__filename).href;" },
});

/** The installed version of a package, read from its package.json by path (not every package exports it). */
function installedVersion(name) {
    let dir;
    try {
        dir = path.dirname(require.resolve(name));
    } catch {
        return null;
    }
    for (let depth = 0; depth < 8; depth += 1) {
        const candidate = path.join(dir, 'package.json');
        if (existsSync(candidate)) {
            const pkg = JSON.parse(readFileSync(candidate, 'utf8'));
            if (pkg.name === name && pkg.version) return pkg.version;
        }
        dir = path.dirname(dir);
    }
    return null;
}

const dependencies = {};
for (const output of Object.values(result.metafile.outputs)) {
    for (const imported of output.imports ?? []) {
        if (!imported.external) continue;
        const name = packageNameOf(imported.path);
        if (isBuiltin(name) || unresolved.has(imported.path)) continue;
        const version = installedVersion(name);
        if (KEEP_EXTERNAL.some((pattern) => matches(pattern, name)) && !version) {
            console.error(
                `Cannot find the installed version of ${name}: add it to apps/functions/package.json.`,
            );
            process.exit(1);
        }
        // Not installed and not required at runtime: an optional `require.resolve` probe (Nest's `file-type`).
        if (!version) unresolved.add(imported.path);
        else dependencies[name] = version;
    }
}

writeFileSync(
    path.join(out, 'package.json'),
    `${JSON.stringify(
        {
            name: 'functions-bundle',
            private: true,
            main: 'index.js',
            engines: { node: '22' },
            dependencies: Object.fromEntries(Object.entries(dependencies).sort()),
        },
        null,
        4,
    )}\n`,
);

if (!process.argv.includes('--no-link')) {
    const link = path.join(out, 'node_modules');
    if (existsSync(link) && lstatSync(link).isSymbolicLink()) rmSync(link);
    if (!existsSync(link)) symlinkSync(path.join(root, 'node_modules'), link, 'dir');
}

const size = (readFileSync(path.join(out, 'index.js')).length / 1024 / 1024).toFixed(1);
console.log(
    `Bundled ${path.relative(process.cwd(), out)}/index.js (${size} MB) in ${Date.now() - started} ms. ` +
        `External: ${Object.keys(dependencies).join(', ')}.` +
        (unresolved.size ? ` Optional, left out: ${[...unresolved].sort().join(', ')}.` : ''),
);
