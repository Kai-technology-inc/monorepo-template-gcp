import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

function classes(variant: ButtonVariant, block: boolean | undefined, extra?: string): string {
    return ['ui-button', `ui-button--${variant}`, block ? 'ui-button--block' : '', extra ?? '']
        .filter(Boolean)
        .join(' ');
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    readonly variant?: ButtonVariant;
    readonly block?: boolean;
    /** Shows a spinner and disables the button; pass the "…ing" label as children while it is true. */
    readonly busy?: boolean;
}

export function Button({
    variant = 'primary',
    block,
    busy,
    disabled,
    className,
    children,
    type = 'button',
    ...rest
}: ButtonProps): ReactNode {
    return (
        <button
            {...rest}
            type={type}
            className={classes(variant, block, className)}
            disabled={disabled || busy}
            aria-busy={busy || undefined}
        >
            {busy ? <Spinner /> : null}
            {children}
        </button>
    );
}

export function ButtonLink({
    href,
    variant = 'primary',
    block,
    children,
}: {
    readonly href: string;
    readonly variant?: ButtonVariant;
    readonly block?: boolean;
    readonly children: ReactNode;
}): ReactNode {
    return (
        <Link href={href} className={classes(variant, block)}>
            {children}
        </Link>
    );
}
