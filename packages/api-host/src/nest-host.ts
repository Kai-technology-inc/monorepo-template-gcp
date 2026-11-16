import 'reflect-metadata';
import express from 'express';
import { Module, type INestApplication, type Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { configureApp } from './app.setup';
import { PLATFORM_MODULES } from './platform-modules';

/**
 * ONE HTTP FUNCTION, DECLARED ONCE
 *
 * Its route (the name in the URL and in `API_FUNCTIONS`), the Swagger title, and the product modules it loads
 * lazily, so each Function boots only what it serves.
 */
export interface FunctionDefinition {
    readonly route: string;
    readonly title: string;
    readonly load: () => Promise<Type<unknown>[]>;
}

export interface NestHost<TName extends string> {
    readonly names: readonly TName[];
    readonly routeOf: (name: TName) => string;
    readonly getAppModule: (name: TName) => Promise<Type<unknown>>;
    readonly getNestApplication: (name: TName) => Promise<INestApplication>;
    readonly getExpressServer: (name: TName) => Promise<express.Express>;
}

/**
 * The host of a Functions codebase: one Nest application per Function name, created by the first request that
 * needs it and kept for the life of the container (cold start pays it once).
 */
export function createNestHost<TName extends string>(
    definitions: Readonly<Record<TName, FunctionDefinition>>,
): NestHost<TName> {
    const names = Object.keys(definitions) as TName[];
    const modules = new Map<TName, Type<unknown>>();
    const applications = new Map<TName, Promise<INestApplication>>();

    async function getAppModule(name: TName): Promise<Type<unknown>> {
        const cached = modules.get(name);
        if (cached) return cached;
        const productModules = await definitions[name].load();

        @Module({ imports: [...PLATFORM_MODULES, ...productModules] })
        class FunctionAppModule {}

        Object.defineProperty(FunctionAppModule, 'name', {
            value: `${pascalCase(name)}FunctionModule`,
        });
        modules.set(name, FunctionAppModule);
        return FunctionAppModule;
    }

    async function boot(name: TName): Promise<INestApplication> {
        const server = express();
        server.disable('x-powered-by');
        server.set('trust proxy', true);
        const app = await NestFactory.create(await getAppModule(name), new ExpressAdapter(server), {
            bufferLogs: false,
        });
        configureApp(app, { title: definitions[name].title });
        await app.init();
        return app;
    }

    function getNestApplication(name: TName): Promise<INestApplication> {
        let app = applications.get(name);
        if (!app) {
            app = boot(name);
            // A failed boot must not be cached forever: the next request retries.
            app.catch(() => applications.delete(name));
            applications.set(name, app);
        }
        return app;
    }

    return {
        names,
        routeOf: (name) => definitions[name].route,
        getAppModule,
        getNestApplication,
        getExpressServer: async (name) =>
            (await getNestApplication(name)).getHttpAdapter().getInstance() as express.Express,
    };
}

function pascalCase(value: string): string {
    return value
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
}
