import { expect, test } from '@playwright/test';
import { apiRoutes } from '@app/contracts';
import { STACK } from './stack';
import { newPerson, registerThroughTheScreen, toApi, welcome, t } from './support';

/**
 * Signing up and signing in: the identity lives in Firebase Auth, the profile and workspace in the API. These specs
 * check both halves of each step: what the person sees, and exactly what the web asks the API for.
 */
test('registering creates the profile and the first workspace in the API, then opens the dashboard', async ({
    page,
}) => {
    const ada = newPerson('Ada');
    await page.goto('/auth/register');
    await page.getByLabel(t('auth.register.displayName'), { exact: true }).fill(ada.name);
    await page.getByLabel(t('common.email'), { exact: true }).fill(ada.email);
    await page.getByLabel(t('common.password'), { exact: true }).fill(ada.password);
    await page.getByLabel(t('auth.register.workspaceName'), { exact: true }).fill(ada.workspace);

    const registering = page.waitForRequest(toApi('POST', apiRoutes.account.register()));
    await page.getByRole('button', { name: t('auth.register.submit'), exact: true }).click();
    const request = await registering;

    // What the web sends: the profile and the workspace, in the screen's language, with the new identity's token.
    expect(request.postDataJSON()).toEqual({
        displayName: ada.name,
        locale: 'en',
        workspaceName: ada.workspace,
    });
    expect((await request.allHeaders()).authorization).toMatch(/^Bearer \S+$/);
    expect((await request.response())?.status()).toBe(201);

    // What the person sees: their dashboard, as owner of the workspace they named.
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(welcome(page, ada)).toBeVisible();
    await expect(
        page.getByText(
            t('dashboard.workspaceSummary', { workspace: ada.workspace, role: t('roles.OWNER') }),
        ),
    ).toBeVisible();
});

test('signing in sends the password to Firebase only, then loads the session from the API with the token', async ({
    page,
}) => {
    const ada = newPerson('Ada');
    await registerThroughTheScreen(page, ada);
    await page.getByRole('button', { name: t('common.signOut'), exact: true }).click();
    await expect(page).toHaveURL(/\/auth\/login/);

    const sentToApi: string[] = [];
    page.on('request', (request) => {
        if (request.url().startsWith(STACK.api)) sentToApi.push(request.postData() ?? '');
    });
    await page.getByLabel(t('common.email'), { exact: true }).fill(ada.email);
    await page.getByLabel(t('common.password'), { exact: true }).fill(ada.password);
    const loadingSession = page.waitForRequest(toApi('GET', apiRoutes.account.session()));
    await page.getByRole('button', { name: t('auth.login.submit'), exact: true }).click();
    const request = await loadingSession;

    expect((await request.allHeaders()).authorization).toMatch(/^Bearer \S+$/);
    expect(request.postData()).toBeNull();
    expect((await request.response())?.status()).toBe(200);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(welcome(page, ada)).toBeVisible();
    expect(sentToApi.join('\n')).not.toContain(ada.password);
});

test('a wrong password shows the error and never reaches the API', async ({ page }) => {
    const ada = newPerson('Ada');
    await registerThroughTheScreen(page, ada);
    await page.getByRole('button', { name: t('common.signOut'), exact: true }).click();
    await expect(page).toHaveURL(/\/auth\/login/);

    const apiCalls: string[] = [];
    page.on('request', (request) => {
        if (request.url().startsWith(STACK.api)) apiCalls.push(request.url());
    });
    await page.getByLabel(t('common.email'), { exact: true }).fill(ada.email);
    await page.getByLabel(t('common.password'), { exact: true }).fill('not-the-password');
    await page.getByRole('button', { name: t('auth.login.submit'), exact: true }).click();

    await expect(page.getByText(t('auth.errors.invalidCredential'))).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/);
    expect(apiCalls).toEqual([]);
});
