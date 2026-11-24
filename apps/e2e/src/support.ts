import { expect, type Locator, type Page, type Request, type Response } from '@playwright/test';
import { apiRoutes, SessionSchema, type Session } from '@app/contracts';
import { createTranslator, type Translate } from '@app/i18n';
import { en } from '@app/i18n/messages/en';
import { STACK } from './stack';

/**
 * What the screen says, in English, from the same dictionary the web renders: a reworded label changes the
 * dictionary, not the tests. (The browser runs with `locale: 'en-US'`, so the web picks English.)
 */
export const t: Translate = createTranslator('en', en);

export interface Person {
    readonly name: string;
    readonly email: string;
    readonly password: string;
    readonly workspace: string;
}

/** A person nobody registered yet: the emulators keep state for the whole run, so every test brings new ones. */
export function newPerson(first: string): Person {
    const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    return {
        name: `${first} Tester`,
        email: `${first.toLowerCase()}.${unique}@example.com`,
        password: `pw-${unique}-long-enough`,
        workspace: `${first} Co ${unique.slice(-4)}`,
    };
}

/** Matches a request the web sends to the API: method and path, preflights excluded. */
export function toApi(method: string, path: string): (request: Request) => boolean {
    return (request) =>
        request.method() === method &&
        request.url().startsWith(STACK.api) &&
        new URL(request.url()).pathname === path;
}

/** Matches the API's answer to `method path`. */
export function fromApi(method: string, path: string): (response: Response) => boolean {
    return (response) => toApi(method, path)(response.request());
}

export interface Registered {
    readonly session: Session;
    /** The `Authorization` header the web sent: the person's Firebase ID token, as a bearer. */
    readonly authorization: string;
}

/** Registers `person` through the register screen and waits for the dashboard. */
export async function registerThroughTheScreen(page: Page, person: Person): Promise<Registered> {
    await page.goto('/auth/register');
    await page.getByLabel(t('auth.register.displayName'), { exact: true }).fill(person.name);
    await page.getByLabel(t('common.email'), { exact: true }).fill(person.email);
    await page.getByLabel(t('common.password'), { exact: true }).fill(person.password);
    await page.getByLabel(t('auth.register.workspaceName'), { exact: true }).fill(person.workspace);
    const registering = page.waitForRequest(toApi('POST', apiRoutes.account.register()));
    await page.getByRole('button', { name: t('auth.register.submit'), exact: true }).click();
    const request = await registering;
    const response = await request.response();
    expect(response?.status()).toBe(201);
    const session = SessionSchema.parse(await response?.json());
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(welcome(page, person)).toBeVisible();
    return { session, authorization: (await request.allHeaders()).authorization ?? '' };
}

/** The dashboard's greeting: once it shows, the session is loaded and the dashboard rendered. */
export function welcome(page: Page, person: Person): Locator {
    return page.getByRole('heading', {
        level: 1,
        name: t('dashboard.welcome', { name: person.name }),
    });
}
