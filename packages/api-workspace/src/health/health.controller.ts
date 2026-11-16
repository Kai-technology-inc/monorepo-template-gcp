import { Controller, Get, type Type } from '@nestjs/common';
import { Public } from '@app/api-core/auth/decorators';

export interface HealthStatus {
    readonly status: 'ok';
    readonly service: string;
}

/**
 * `GET /health` for one service (`/account/health`, `/workspaces/health`). Public and dependency-free on purpose: it
 * answers "is this Function up", which is what uptime checks and the deploy script ask. Add a readiness check with
 * real dependencies as a separate route if you need one.
 */
export function createHealthController(service: string): Type<unknown> {
    @Controller('health')
    class HealthController {
        @Public()
        @Get()
        check(): HealthStatus {
            return { status: 'ok', service };
        }
    }
    Object.defineProperty(HealthController, 'name', {
        value: `${service.charAt(0).toUpperCase()}${service.slice(1)}HealthController`,
    });
    return HealthController;
}
