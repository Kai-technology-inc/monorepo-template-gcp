import type { ReactNode } from 'react';

export function EmptyState({ children }: { readonly children: ReactNode }): ReactNode {
    return <div className="ui-empty">{children}</div>;
}
