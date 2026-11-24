import { expect, test } from '@playwright/test';
import { apiRoutes } from '@app/contracts';
import { newPerson, registerThroughTheScreen, toApi, t } from './support';

/** A write through the API: inviting someone to the workspace. */
test('an owner invites someone: the web sends the email and role, and shows the link to share', async ({
    page,
}) => {
    const { session } = await registerThroughTheScreen(page, newPerson('Ada'));
    const workspaceId = session.workspace?.id ?? '';

    await page
        .getByRole('navigation', { name: t('nav.main') })
        .getByRole('link', { name: t('nav.members'), exact: true })
        .click();
    await expect(page).toHaveURL(/\/members$/);

    const typed = `Bea.Invited+${Date.now().toString(36)}@Example.com`;
    await page.getByLabel(t('members.invite.email'), { exact: true }).fill(typed);
    await page.getByLabel(t('members.invite.role'), { exact: true }).selectOption('ADMIN');
    const inviting = page.waitForRequest(
        toApi('POST', apiRoutes.workspaces.invitations(workspaceId)),
    );
    await page.getByRole('button', { name: t('members.invite.submit'), exact: true }).click();
    const request = await inviting;

    // What the web sends: what the person typed and chose, as typed. The API normalizes the email.
    expect(request.postDataJSON()).toEqual({ email: typed, role: 'ADMIN' });
    expect((await request.response())?.status()).toBe(201);

    // What the person sees: the confirmation with the normalized email, the link to share, and the pending row
    // the list reloaded from the API.
    const normalized = typed.toLowerCase();
    await expect(page.getByText(t('members.invite.created', { email: normalized }))).toBeVisible();
    await expect(page.getByLabel(t('members.invite.linkLabel'), { exact: true })).toHaveValue(
        new RegExp(`/auth/invitations/accept\\?workspace=${workspaceId}&invitation=[^&]+&token=.+`),
    );
    await expect(
        page
            .getByRole('table', { name: t('members.pending.title') })
            .getByRole('cell', { name: normalized, exact: true }),
    ).toBeVisible();
});
