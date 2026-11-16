/**
 * URLS ARE ENGLISH, LOWERCASE AND KEBAB-CASE, IN EVERY LANGUAGE
 *
 * The screen can speak Spanish; the address does not. A route segment is either a literal (`members`,
 * `active-workspace`) or a parameter (`:workspaceId`). Both the API (`apps/api/src/arch/url-vocabulary.spec.ts`)
 * and the web (`apps/web/src/lib/url-vocabulary.spec.ts`) check every route against these rules.
 */
export const LITERAL_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PARAM_SEGMENT = /^:[a-z][a-zA-Z0-9]*$/;
/** Next.js dynamic and group segments: `[workspaceId]`, `(auth)`. */
export const NEXT_DYNAMIC_SEGMENT = /^\[(?:\.\.\.)?[a-z][a-zA-Z0-9]*\]$/;
export const NEXT_GROUP_SEGMENT = /^\([a-z]+(?:-[a-z]+)*\)$/;

export function invalidApiSegments(path: string): string[] {
    return path
        .split('/')
        .filter(Boolean)
        .filter((segment) => !LITERAL_SEGMENT.test(segment) && !PARAM_SEGMENT.test(segment));
}

export function invalidWebSegments(path: string): string[] {
    return path
        .split('/')
        .filter(Boolean)
        .filter(
            (segment) =>
                !LITERAL_SEGMENT.test(segment) &&
                !NEXT_DYNAMIC_SEGMENT.test(segment) &&
                !NEXT_GROUP_SEGMENT.test(segment),
        );
}
