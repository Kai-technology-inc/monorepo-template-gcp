/**
 * Cloud Functions mounts each HTTP Function at `/<name>` and Nest expects routes from the root, so the prefix is
 * removed before Nest sees the request: once or several times, because the emulator and Hosting rewrites can
 * repeat it. The query string is kept.
 */
export function stripFunctionPrefix(url: string, functionRoute: string): string {
    const queryIndex = url.indexOf('?');
    const search = queryIndex === -1 ? '' : url.slice(queryIndex);
    const rawPathname = queryIndex === -1 ? url : url.slice(0, queryIndex);
    let pathname = rawPathname.startsWith('/') ? rawPathname : `/${rawPathname}`;
    const route = functionRoute.replace(/^\/+|\/+$/g, '');
    const prefix = route ? `/${route}` : '';
    while (prefix && (pathname === prefix || pathname.startsWith(`${prefix}/`))) {
        pathname = pathname.slice(prefix.length) || '/';
    }
    return `${pathname || '/'}${search}`;
}
