import 'reflect-metadata';
import { RequestMethod, type Type } from '@nestjs/common';
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { FUNCTION_MODULES } from '../app.module';

export interface Route {
    readonly method: string;
    readonly path: string;
}

function join(...parts: string[]): string {
    const joined = parts
        .flatMap((part) => part.split('/'))
        .filter(Boolean)
        .join('/');
    return `/${joined}`;
}

/** Every route the API serves, read from Nest's metadata: `{ method: 'GET', path: '/account/session' }`. */
export function apiRoutes(): Route[] {
    return Object.entries(FUNCTION_MODULES).flatMap(([prefix, module]) => {
        const controllers = (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, module) ??
            []) as Type<unknown>[];
        return controllers.flatMap((controller) => {
            const base =
                (Reflect.getMetadata(PATH_METADATA, controller) as string | undefined) ?? '';
            const prototype = controller.prototype as Record<string, unknown>;
            return Object.getOwnPropertyNames(prototype)
                .filter((key) => key !== 'constructor' && typeof prototype[key] === 'function')
                .map((key) => prototype[key] as object)
                .filter((handler) => Reflect.getMetadata(PATH_METADATA, handler) !== undefined)
                .map((handler) => ({
                    method: RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as number],
                    path: join(prefix, base, Reflect.getMetadata(PATH_METADATA, handler) as string),
                }));
        });
    });
}
