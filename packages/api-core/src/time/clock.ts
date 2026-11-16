/**
 * The current time, injected. Services never call `new Date()` for a rule that depends on time (expiry, ordering):
 * they ask the clock, and tests pass a fixed one.
 */
export const CLOCK = Symbol('CLOCK');

export interface Clock {
    now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export function fixedClock(
    iso: string,
): Clock & { advance(ms: number): void; set(iso: string): void } {
    let current = new Date(iso);
    return {
        now: () => new Date(current.getTime()),
        advance: (ms) => {
            current = new Date(current.getTime() + ms);
        },
        set: (value) => {
            current = new Date(value);
        },
    };
}
