import type { ReactNode } from 'react';

export function Spinner(): ReactNode {
    return <span className="ui-spinner" aria-hidden="true" />;
}

/** A centered spinner with a label: what a screen shows while its data loads. */
export function Loading({ label }: { readonly label: string }): ReactNode {
    return (
        <div className="ui-loading" role="status" aria-live="polite">
            <Spinner />
            <span>{label}</span>
        </div>
    );
}
