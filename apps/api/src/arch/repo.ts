import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/** The repository root, from `apps/api/src/arch`. */
export const REPO_ROOT = path.resolve(__dirname, '../../../..');

export interface WorkspacePackage {
    readonly name: string;
    readonly dir: string;
}

/** Every package of the pnpm workspace (`apps/*`, `packages/*`) that has a `src/`. */
export function workspacePackages(): WorkspacePackage[] {
    return ['apps', 'packages'].flatMap((group) =>
        readdirSync(path.join(REPO_ROOT, group))
            .map((entry) => path.join(REPO_ROOT, group, entry))
            .filter(
                (dir) =>
                    existsSync(path.join(dir, 'package.json')) && existsSync(path.join(dir, 'src')),
            )
            .map((dir) => ({
                name: (
                    JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as {
                        name: string;
                    }
                ).name,
                dir,
            })),
    );
}

export function sourceFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
        if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
        else if (/\.(ts|tsx|mts)$/.test(entry) && !entry.endsWith('.d.ts')) out.push(full);
    }
    return out;
}

const IMPORT =
    /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s+['"]([^'"]+)['"]/gm;

/** The workspace packages (`@app/x`) a file imports, by package name. */
export function workspaceImports(file: string): string[] {
    const source = readFileSync(file, 'utf8');
    const found = new Set<string>();
    for (const match of source.matchAll(IMPORT)) {
        const specifier = match[1] ?? match[2] ?? match[3] ?? match[4];
        if (!specifier?.startsWith('@app/')) continue;
        found.add(specifier.split('/').slice(0, 2).join('/'));
    }
    return [...found];
}
