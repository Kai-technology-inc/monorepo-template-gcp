'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface QueryResult<T> {
    readonly key: string;
    readonly version: number;
    readonly data: T | null;
    readonly error: unknown;
}

export interface ApiQuery<T> {
    /** The last data read for this key; kept while a reload is in flight. */
    readonly data: T | null;
    readonly error: unknown;
    readonly loading: boolean;
    /** Reads again. Call it from an event handler after a change. */
    readonly reload: () => void;
}

/**
 * READ SOMETHING FROM THE API FOR A SCREEN
 *
 * `key` identifies what is being read (usually the URL); `null` means "nothing to read yet". When the key changes,
 * the previous request is aborted and its answer ignored, so a fast switch between workspaces never shows the
 * old one's data. State only changes when an answer arrives, never synchronously inside the effect.
 */
export function useApiQuery<T>(
    key: string | null,
    fetcher: (signal: AbortSignal) => Promise<T>,
): ApiQuery<T> {
    const [version, setVersion] = useState(0);
    const [result, setResult] = useState<QueryResult<T> | null>(null);
    const fetcherRef = useRef(fetcher);

    useEffect(() => {
        fetcherRef.current = fetcher;
    });

    useEffect(() => {
        if (!key) return;
        const controller = new AbortController();
        fetcherRef.current(controller.signal).then(
            (data) => {
                if (!controller.signal.aborted) setResult({ key, version, data, error: null });
            },
            (error: unknown) => {
                if (!controller.signal.aborted) setResult({ key, version, data: null, error });
            },
        );
        return () => controller.abort();
    }, [key, version]);

    const reload = useCallback(() => setVersion((current) => current + 1), []);
    const current = result && result.key === key ? result : null;
    return {
        data: current?.data ?? null,
        error: current?.error ?? null,
        loading: key !== null && (current === null || current.version !== version),
        reload,
    };
}
