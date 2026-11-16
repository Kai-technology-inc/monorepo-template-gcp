/** Liveness for App Hosting and uptime checks. Static: it never touches Firebase or the API. */
export const dynamic = 'force-static';

export function GET(): Response {
    return Response.json({ status: 'ok', service: 'web' });
}
