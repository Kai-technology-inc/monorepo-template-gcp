import type { ReactNode } from 'react';
import { AppShell } from '@app/web-platform';

/** Every page in this group requires a session: `AppShell` gates it (see `gateDecision`). */
export default function AppLayout({ children }: { readonly children: ReactNode }): ReactNode {
    return <AppShell>{children}</AppShell>;
}
