import { expect, test } from '@playwright/test';
import { apiRoutes, SessionSchema } from '@app/contracts';
import { STACK } from './stack';
import { fromApi, newPerson, registerThroughTheScreen, welcome, t } from './support';

/**
 * Deploying is not releasing (docs/FLAGS.md): the "What's new" card is deployed but switched off. An operator
 * turns it on for their own team through the admin route, everyone else keeps the old dashboard, and the kill
 * switch takes it away again. No deploy in between: only the session the web reads changes.
 */
test('the example flag changes what the dashboard shows: the team first, nobody else, then off', async ({
    page,
    browser,
    request,
}) => {
    const whatsNew = t('dashboard.whatsNew.title');
    const ada = newPerson('Ada');
    const { session, authorization } = await registerThroughTheScreen(page, ada);
    const workspaceId = session.workspace?.id ?? '';
    expect(session.flags['dashboard-whats-new']).toBe(false);
    await expect(page.getByRole('heading', { name: whatsNew })).toHaveCount(0);

    // The operator (Ada owns this workspace; the e2e API lets any local workspace operate flags) turns it on for
    // her team: an allow-list with her workspace.
    const flag = `${STACK.api}${apiRoutes.workspaces.flag(workspaceId, 'dashboard-whats-new')}`;
    const on = await request.put(flag, {
        headers: { authorization },
        data: { value: true, allowList: { workspaceIds: [workspaceId] } },
    });
    expect(on.status()).toBe(200);

    // Ada reloads: the web reads the session again, which now carries the flag, and shows the card.
    const reading = page.waitForResponse(fromApi('GET', apiRoutes.account.session()));
    await page.reload();
    const flags = SessionSchema.parse(await (await reading).json()).flags;
    expect(flags['dashboard-whats-new']).toBe(true);
    await expect(page.getByRole('heading', { name: whatsNew })).toBeVisible();
    await expect(page.getByText(t('dashboard.whatsNew.body'))).toBeVisible();

    // Bea, in another workspace, is not in the team: same deploy, old dashboard.
    const elsewhere = await browser.newContext({ baseURL: STACK.web, locale: 'en-US' });
    const beaPage = await elsewhere.newPage();
    const bea = newPerson('Bea');
    const { session: beaSession } = await registerThroughTheScreen(beaPage, bea);
    expect(beaSession.flags['dashboard-whats-new']).toBe(false);
    await expect(welcome(beaPage, bea)).toBeVisible();
    await expect(beaPage.getByRole('heading', { name: whatsNew })).toHaveCount(0);
    await elsewhere.close();

    // The kill switch: everyone back to the declared default.
    const off = await request.delete(flag, { headers: { authorization } });
    expect(off.status()).toBe(204);
    await page.reload();
    await expect(welcome(page, ada)).toBeVisible();
    await expect(page.getByRole('heading', { name: whatsNew })).toHaveCount(0);
});
