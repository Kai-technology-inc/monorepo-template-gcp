#!/usr/bin/env node
/**
 * `pnpm --filter @app/api dev`: build once, then one `tsc --watch` per project (this app and every package it
 * references in `tsconfig.json`), and `node --watch` on the output, which restarts when any emitted file changes.
 *
 * Why tsc and one watcher per project: Nest's dependency injection needs `emitDecoratorMetadata`, which only the
 * type checker emits correctly (esbuild/swc-style transpilers guess), and the native `tsc -b --watch` does not
 * watch referenced projects, so editing a package would not rebuild it.
 */
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

if (!existsSync('.env')) {
    copyFileSync('.env.example', '.env');
    console.log('Created apps/api/.env from .env.example');
}

const initial = spawnSync('tsc', ['-b', 'tsconfig.build.json'], { stdio: 'inherit' });
if (initial.status !== 0) process.exit(initial.status ?? 1);

const references = JSON.parse(readFileSync('tsconfig.json', 'utf8')).references ?? [];
const projects = [...references.map((reference) => reference.path), 'tsconfig.build.json'];

const children = [
    ...projects.map((project) =>
        spawn('tsc', ['-p', project, '--watch', '--preserveWatchOutput'], {
            stdio: ['ignore', 'pipe', 'inherit'],
        }),
    ),
    spawn(process.execPath, ['--watch', '--env-file=.env', 'dist/main.js'], { stdio: 'inherit' }),
];

// The watchers are chatty ("Starting compilation…" × N); only errors are worth showing.
children.slice(0, projects.length).forEach((child, index) => {
    const name = path.basename(path.dirname(path.resolve(projects[index])));
    child.stdout.on('data', (chunk) => {
        for (const line of chunk.toString().split('\n')) {
            if (/error TS\d+/.test(line)) console.error(`[${name}] ${line}`);
        }
    });
});

const stop = () => {
    for (const child of children) child.kill('SIGTERM');
    process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children) child.on('exit', (code) => code && stop());
