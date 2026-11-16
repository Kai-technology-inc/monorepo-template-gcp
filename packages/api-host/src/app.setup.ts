import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { REQUEST_ID_HEADER } from '@app/contracts';
import { isProduction, readAllowedOrigins } from '@app/api-core/config/environment';
import { AllExceptionsFilter } from '@app/api-core/http/all-exceptions.filter';
import { requestIdMiddleware } from '@app/api-core/http/request-id';
import { corsOptions } from './cors-policy';

export interface ConfigureAppOptions {
    /** Title of the OpenAPI document of the function being mounted. */
    readonly title?: string;
    /** Serve Swagger at `/docs`. Defaults to "not production". */
    readonly swagger?: boolean;
}

/**
 * The cross-cutting setup of any Nest instance, the local server's and each Cloud Function's: the request id,
 * security headers, CORS from `ALLOWED_ORIGINS`, the error format, and Swagger outside production.
 * Validation is per route with the contract's zod schema (`ZodBody`), so there is no global ValidationPipe.
 */
export function configureApp(app: INestApplication, options: ConfigureAppOptions = {}): void {
    app.use(requestIdMiddleware);
    // An API serves no content: the most restrictive CSP is the right one.
    app.use(
        helmet({
            contentSecurityPolicy: {
                directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
            },
            crossOriginResourcePolicy: { policy: 'same-site' },
            referrerPolicy: { policy: 'no-referrer' },
        }),
    );
    app.enableCors(corsOptions(readAllowedOrigins()));
    app.useGlobalFilters(new AllExceptionsFilter());

    if (options.swagger ?? !isProduction()) {
        const config = new DocumentBuilder()
            .setTitle(options.title ?? 'API')
            .setDescription('See docs/API.md for the contract of every route.')
            .addBearerAuth()
            .addGlobalParameters({ in: 'header', name: REQUEST_ID_HEADER, required: false })
            .build();
        SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
    }
}
