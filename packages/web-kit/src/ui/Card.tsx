import type { ReactNode } from 'react';

export function Card({
    title,
    children,
    as: Tag = 'section',
}: {
    readonly title?: string;
    readonly children: ReactNode;
    readonly as?: 'section' | 'div' | 'article';
}): ReactNode {
    return (
        <Tag className="ui-card">
            {title ? <h2 className="ui-card__title">{title}</h2> : null}
            {children}
        </Tag>
    );
}
