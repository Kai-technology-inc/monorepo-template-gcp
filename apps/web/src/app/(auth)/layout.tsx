import type { ReactNode } from 'react';
import { AuthShell } from '@app/web-platform';

export default function AuthLayout({ children }: { readonly children: ReactNode }): ReactNode {
    return <AuthShell>{children}</AuthShell>;
}
