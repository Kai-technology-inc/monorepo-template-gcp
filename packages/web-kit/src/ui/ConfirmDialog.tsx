'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './Button';

export interface ConfirmDialogProps {
    readonly open: boolean;
    readonly title: string;
    readonly children: ReactNode;
    readonly confirmLabel: string;
    readonly cancelLabel: string;
    readonly busy?: boolean;
    readonly destructive?: boolean;
    readonly onConfirm: () => void;
    readonly onCancel: () => void;
}

/**
 * A modal confirmation on the native `<dialog>`: focus trapping, Escape and the backdrop come from the browser.
 */
export function ConfirmDialog({
    open,
    title,
    children,
    confirmLabel,
    cancelLabel,
    busy,
    destructive,
    onConfirm,
    onCancel,
}: ConfirmDialogProps): ReactNode {
    const ref = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog) return;
        if (open && !dialog.open) dialog.showModal();
        if (!open && dialog.open) dialog.close();
    }, [open]);

    return (
        <dialog
            ref={ref}
            className="ui-dialog"
            aria-labelledby="confirm-dialog-title"
            onCancel={(event) => {
                event.preventDefault();
                onCancel();
            }}
        >
            <h2 className="ui-dialog__title" id="confirm-dialog-title">
                {title}
            </h2>
            <div>{children}</div>
            <div className="ui-dialog__actions">
                <Button variant="secondary" onClick={onCancel} disabled={busy}>
                    {cancelLabel}
                </Button>
                <Button
                    variant={destructive ? 'danger' : 'primary'}
                    onClick={onConfirm}
                    busy={busy}
                >
                    {confirmLabel}
                </Button>
            </div>
        </dialog>
    );
}
