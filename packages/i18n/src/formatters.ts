import type { Locale } from '@app/contracts';

/**
 * DATES, NUMBERS AND LISTS SPEAK THE LANGUAGE TOO
 *
 * Never `toLocaleDateString()` without a locale and never a hand-built "dd/mm/yyyy": use these, so the format follows
 * the person's language and not the server's or the browser's defaults. `timeZone` defaults to the runtime's;
 * pass the workspace's when you have one, so the server render and the browser agree.
 */
export interface Formatters {
    readonly date: (value: Date | string | number, style?: 'short' | 'medium' | 'long') => string;
    readonly dateTime: (value: Date | string | number) => string;
    readonly number: (value: number, options?: Intl.NumberFormatOptions) => string;
    readonly currency: (value: number, currency: string) => string;
    readonly percent: (value: number) => string;
    readonly relativeTime: (value: Date | string | number, now?: Date) => string;
    readonly list: (items: readonly string[], type?: 'conjunction' | 'disjunction') => string;
}

const UNITS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 365 * 24 * 3600],
    ['month', 30 * 24 * 3600],
    ['week', 7 * 24 * 3600],
    ['day', 24 * 3600],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
];

function toDate(value: Date | string | number): Date {
    return value instanceof Date ? value : new Date(value);
}

export function createFormatters(locale: Locale, timeZone?: string): Formatters {
    const zone = timeZone ? { timeZone } : {};
    return {
        date: (value, style = 'medium') =>
            new Intl.DateTimeFormat(locale, { dateStyle: style, ...zone }).format(toDate(value)),
        dateTime: (value) =>
            new Intl.DateTimeFormat(locale, {
                dateStyle: 'medium',
                timeStyle: 'short',
                ...zone,
            }).format(toDate(value)),
        number: (value, options) => new Intl.NumberFormat(locale, options).format(value),
        currency: (value, currency) =>
            new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value),
        percent: (value) =>
            new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(
                value,
            ),
        relativeTime: (value, now = new Date()) => {
            const seconds = Math.round((toDate(value).getTime() - now.getTime()) / 1000);
            const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
            for (const [unit, size] of UNITS) {
                if (Math.abs(seconds) >= size || unit === 'second') {
                    return format.format(Math.round(seconds / size), unit);
                }
            }
            return format.format(0, 'second');
        },
        list: (items, type = 'conjunction') =>
            new Intl.ListFormat(locale, { style: 'long', type }).format(items),
    };
}
