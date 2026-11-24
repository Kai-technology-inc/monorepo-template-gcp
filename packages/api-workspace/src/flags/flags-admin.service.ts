import { Injectable } from '@nestjs/common';
import {
    FLAG_KEYS,
    flagDefinition,
    isFlagKey,
    type FlagKey,
    type FlagListResponse,
    type FlagRule,
    type FlagState,
} from '@app/contracts';
import type { AuthContext } from '@app/api-core/auth/auth-context';
import { canOperateFlagsFrom } from '@app/api-core/config/environment';
import {
    FirestoreFlagsProvider,
    type StoredFlagRule,
} from '@app/api-core/flags/firestore/firestore-flags-provider';
import { FlagsProvider } from '@app/api-core/flags/flags-provider';
import { AppError, notFound } from '@app/api-core/http/app-error';

/**
 * OPERATING FLAGS WITHOUT A CONSOLE (the own provider)
 *
 * List, read, set who gets a flag, turn it off: what a person or an integration does through
 * `/workspaces/:workspaceId/flags` (docs/API.md). Three gates, in order:
 *
 * 1. `flags:manage` (owners and admins), checked by the guard;
 * 2. the workspace is the operator one (`FLAGS_ADMIN_WORKSPACE_ID`): flags are global to the deployment, so the
 *    owner of any other workspace (any customer) gets `403`;
 * 3. the active provider is the own one: LaunchDarkly and Remote Config are operated from their consoles (`409
 *    FLAGS_MANAGED_ELSEWHERE`).
 */
@Injectable()
export class FlagsAdminService {
    constructor(private readonly provider: FlagsProvider) {}

    async list(workspaceId: string): Promise<FlagListResponse> {
        const own = this.own(workspaceId);
        const rules = await own.readRules();
        return {
            provider: own.name,
            flags: FLAG_KEYS.map((key) => stateOf(key, rules.get(key) ?? null)),
        };
    }

    async read(workspaceId: string, flagKey: string): Promise<FlagState> {
        const own = this.own(workspaceId);
        const key = declared(flagKey);
        return stateOf(key, await own.readRule(key));
    }

    /** Sets who gets `flagKey`. `rule.value` must match the flag's schema. */
    async set(
        auth: AuthContext,
        workspaceId: string,
        flagKey: string,
        rule: FlagRule,
    ): Promise<FlagState> {
        const own = this.own(workspaceId);
        const key = declared(flagKey);
        const parsed = flagDefinition(key).schema.safeParse(rule.value);
        if (!parsed.success) {
            throw new AppError('VALIDATION_FAILED', 400, `value does not match ${key}`, {
                value: parsed.error.issues.map((issue) => issue.message),
            });
        }
        return stateOf(key, await own.writeRule(key, rule, auth.userId));
    }

    /** The kill switch: the rule is removed and everyone gets the declared default. */
    async turnOff(workspaceId: string, flagKey: string): Promise<void> {
        const own = this.own(workspaceId);
        await own.deleteRule(declared(flagKey));
    }

    private own(workspaceId: string): FirestoreFlagsProvider {
        if (!canOperateFlagsFrom(workspaceId)) {
            throw new AppError(
                'FORBIDDEN',
                403,
                'Flags are operated only from the workspace in FLAGS_ADMIN_WORKSPACE_ID',
            );
        }
        if (!(this.provider instanceof FirestoreFlagsProvider)) {
            throw new AppError(
                'FLAGS_MANAGED_ELSEWHERE',
                409,
                `Flags come from ${this.provider.name}: operate them in its console or API`,
            );
        }
        return this.provider;
    }
}

function declared(flagKey: string): FlagKey {
    if (!isFlagKey(flagKey)) throw notFound(`No flag ${flagKey} is declared`);
    return flagKey;
}

function stateOf(key: FlagKey, stored: StoredFlagRule | null): FlagState {
    const definition = flagDefinition(key);
    return {
        key,
        type: definition.type,
        description: definition.description,
        addedOn: definition.addedOn,
        defaultValue: definition.defaultValue as FlagState['defaultValue'],
        rule: stored?.rule ?? null,
        updatedAt: stored?.updatedAt ?? null,
        updatedBy: stored?.updatedBy ?? null,
    };
}
