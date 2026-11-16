import type { ReactNode } from 'react';

export type AlertTone = 'error' | 'success' | 'info';

/** Errors are announced immediately (`role="alert"`); the rest politely (`role="status"`). */
export function Alert({
    tone = 'info',
    children,
}: {
    readonly tone?: AlertTone;
    readonly children: ReactNode;
}): ReactNode {
    return (
        <div className={`ui-alert ui-alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
            {children}
        </div>
    );
}
