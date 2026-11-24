import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import {
    readEnvironment,
    readFlagsProviderName,
    readPort,
    readProjectId,
    usesEmulators,
} from '@app/api-core/config/environment';
import { configureApp } from '@app/api-host/app.setup';
import { AppModule } from './app.module';

/** The local API server: `pnpm --filter @app/api dev` (watch) or `start`. Deployed, the Functions serve instead. */
async function bootstrap(): Promise<void> {
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    app.disable('x-powered-by');
    configureApp(app, { title: 'API (local)' });
    const port = readPort();
    await app.listen(port);
    const target = usesEmulators() ? 'emulators' : 'real project';
    Logger.log(
        `API on http://localhost:${port} · ${readEnvironment()} · ${readProjectId() ?? 'no project'} (${target}) · flags: ${readFlagsProviderName()} · docs at /docs`,
        'Bootstrap',
    );
}

void bootstrap();
