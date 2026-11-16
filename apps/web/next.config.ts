import path from 'node:path';
import type { NextConfig } from 'next';

/** Security headers for every route. The API sets its own (helmet); these cover the pages. */
const securityHeaders = [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const nextConfig: NextConfig = {
    reactStrictMode: true,
    poweredByHeader: false,
    /*
     * Monorepo: workspace packages arrive through symlinks from `packages/*`, so file tracing starts at the repo
     * root, and Next compiles them itself. The web packages are published as source (`exports` → `src/`, with
     * `'use client'`, hooks and CSS), which only works if Next transpiles them.
     */
    outputFileTracingRoot: path.join(__dirname, '../../'),
    transpilePackages: ['@app/contracts', '@app/i18n', '@app/web-kit', '@app/web-platform'],
    // Two dev servers from one checkout need separate build folders.
    ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
    async headers() {
        return [{ source: '/:path*', headers: securityHeaders }];
    },
};

export default nextConfig;
