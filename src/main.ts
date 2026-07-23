import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import compression from "compression";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";

import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

// Public, unauthenticated discovery endpoints — these deliberately stay
// wide open to cross-origin browser requests, matching the original app's
// single `Access-Control-Allow-Origin: *` on GET /api/events.
const PUBLIC_CORS_PATHS = new Set(["/events", "/geocode/address-suggestions"]);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // contentSecurityPolicy is meant for browser-rendered pages; this is a
  // pure JSON API. crossOriginResourcePolicy is relaxed to cross-origin
  // since some endpoints are deliberately fetched from other origins (see
  // PUBLIC_CORS_PATHS below) and the rest are gated by CORS_ORIGINS/auth,
  // not CORP.
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(compression());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const configuredOrigins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: configuredOrigins.length > 0 ? configuredOrigins : true,
    credentials: true,
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === "GET" && PUBLIC_CORS_PATHS.has(req.path)) {
      res.header("Access-Control-Allow-Origin", "*");
    }
    next();
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
}

void bootstrap();
