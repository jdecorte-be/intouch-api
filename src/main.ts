import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import type { NextFunction, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import supertokens from 'supertokens-node';
import { middleware as supertokensMiddleware } from 'supertokens-node/framework/express';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

// Public, unauthenticated discovery endpoints — these deliberately stay
// wide open to cross-origin browser requests, matching the original app's
// single `Access-Control-Allow-Origin: *` on GET /api/events.
const PUBLIC_CORS_PATHS = new Set(['/events', '/geocode/address-suggestions']);

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Behind a reverse proxy the client IP is in X-Forwarded-For; without this
  // every request would share the proxy's IP for rate limiting.
  app.set('trust proxy', 1);

  // contentSecurityPolicy is meant for browser-rendered pages; this is a
  // pure JSON API. crossOriginResourcePolicy is relaxed to cross-origin
  // since some endpoints are deliberately fetched from other origins (see
  // PUBLIC_CORS_PATHS below) and the rest are gated by CORS_ORIGINS/auth,
  // not CORP.
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(compression());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const configuredOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configuredOrigins.length === 0 && process.env.NODE_ENV === 'production') {
    throw new Error('CORS_ORIGINS must be set in production');
  }

  app.enableCors({
    origin: configuredOrigins.length > 0 ? configuredOrigins : true,
    allowedHeaders: ['content-type', ...supertokens.getAllCORSHeaders()],
    credentials: true,
  });

  // The global Nest ThrottlerGuard only covers Nest routes, so the SuperTokens
  // middleware below (sign-in, sign-up, password reset) needs its own limiter,
  // registered first. Geocode proxies to Mapbox with our token, so it gets a
  // tighter limit to protect the quota.
  app.use(
    '/auth',
    rateLimit({
      windowMs: 60_000,
      limit: 20,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );
  app.use(
    '/geocode',
    rateLimit({
      windowMs: 60_000,
      limit: 30,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );

  // Serves SuperTokens' own auth routes (signup, signin, signout, session
  // refresh, Google authorisationurl/signinup, password reset) under
  // apiBasePath ("/auth" — see supertokens/supertokens.config.ts). Requests
  // to any other path fall through to Nest's normal routing.
  app.use(supertokensMiddleware());

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' && PUBLIC_CORS_PATHS.has(req.path)) {
      res.header('Access-Control-Allow-Origin', '*');
    }
    next();
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
}

void bootstrap();
