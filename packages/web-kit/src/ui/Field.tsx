import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';

interface FieldFrameProps {
    readonly label: string;
    readonly hint?: string;
    readonly error?: string | null;
}

/**
 * A labelled control. The label, hint and error are wired to the control with `aria-*` so screen readers announce
 * them; every form in the product uses these instead of bare inputs.
 */
function FieldFrame({
    id,
    label,
    hint,
    error,
    children,
}: FieldFrameProps & { readonly id: string; readonly children: ReactNode }): ReactNode {
    return (
        <div className="ui-field">
            <label className="ui-field__label" htmlFor={id}>
                {label}
            </label>
            {children}
            {hint ? (
                <span className="ui-field__hint" id={`${id}-hint`}>
                    {hint}
                </span>
            ) : null}
            {error ? (
                <span className="ui-field__error" id={`${id}-error`} role="alert">
                    {error}
                </span>
            ) : null}
        </div>
    );
}

function describedBy(id: string, hint?: string, error?: string | null): string | undefined {
    const ids = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean);
    return ids.length ? ids.join(' ') : undefined;
}

export type TextFieldProps = FieldFrameProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>;

export function TextField({ label, hint, error, ...input }: TextFieldProps): ReactNode {
    const id = useId();
    return (
        <FieldFrame id={id} label={label} hint={hint} error={error}>
            <input
                {...input}
                id={id}
                className="ui-input"
                aria-invalid={error ? true : undefined}
                aria-describedby={describedBy(id, hint, error)}
            />
        </FieldFrame>
    );
}

export interface SelectOption {
    readonly value: string;
    readonly label: string;
}

export type SelectFieldProps = FieldFrameProps &
    Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
        readonly options: readonly SelectOption[];
    };

export function SelectField({
    label,
    hint,
    error,
    options,
    ...select
}: SelectFieldProps): ReactNode {
    const id = useId();
    return (
        <FieldFrame id={id} label={label} hint={hint} error={error}>
            <select
                {...select}
                id={id}
                className="ui-select"
                aria-describedby={describedBy(id, hint, error)}
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </FieldFrame>
    );
}

/** A select without a visible label (the label is for assistive technology only), for tables and toolbars. */
export function InlineSelect({
    label,
    options,
    ...select
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'aria-label'> & {
    readonly label: string;
    readonly options: readonly SelectOption[];
}): ReactNode {
    return (
        <select {...select} aria-label={label} className="ui-select">
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}
