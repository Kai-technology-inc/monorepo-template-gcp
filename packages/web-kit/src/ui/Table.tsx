import type { ReactNode } from 'react';

export interface TableColumn {
    readonly key: string;
    readonly label: string;
    /** Header hidden visually but kept for screen readers (e.g. an actions column). */
    readonly hidden?: boolean;
}

export function Table({
    caption,
    columns,
    children,
}: {
    readonly caption: string;
    readonly columns: readonly TableColumn[];
    readonly children: ReactNode;
}): ReactNode {
    return (
        <div className="ui-table-wrap">
            <table className="ui-table">
                <caption className="visually-hidden">{caption}</caption>
                <thead>
                    <tr>
                        {columns.map((column) => (
                            <th
                                key={column.key}
                                scope="col"
                                className={column.hidden ? 'visually-hidden' : undefined}
                            >
                                {column.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>{children}</tbody>
            </table>
        </div>
    );
}
