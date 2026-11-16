import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { API_FUNCTIONS, type ApiFunctionName } from '@app/contracts';
import { PLATFORM_MODULES } from '@app/api-host/platform-modules';
import { AccountModule } from '@app/api-workspace/account/account.module';
import { WorkspacesModule } from '@app/api-workspace/workspaces/workspaces.module';

/**
 * THE LOCAL SERVER: EVERY FUNCTION IN ONE PROCESS, UNDER THE SAME PATHS
 *
 * Deployed, each product module is its own Cloud Function mounted at `/<name>` (`apps/functions/src/index.ts`).
 * Here the same modules sit behind a `RouterModule` prefix with that name, so `/account/session` is the same URL in
 * both. A new Function is a line in `API_FUNCTIONS`, one here and one in the Functions index; the arch spec
 * `url-vocabulary.spec.ts` fails if they disagree.
 */
export const FUNCTION_MODULES: Readonly<Record<ApiFunctionName, typeof AccountModule>> = {
    account: AccountModule,
    workspaces: WorkspacesModule,
};

@Module({
    imports: [
        ...PLATFORM_MODULES,
        ...Object.values(FUNCTION_MODULES),
        RouterModule.register(
            API_FUNCTIONS.map((name) => ({ path: name, module: FUNCTION_MODULES[name] })),
        ),
    ],
})
export class AppModule {}
