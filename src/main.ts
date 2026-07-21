import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NextFunction, Request, Response } from "express";

import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

// Public, unauthenticated discovery endpoints — these deliberately stay
// wide open to cross-origin browser requests, matching the original app's
// single `Access-Control-Allow-Origin: *` on GET /api/events.
const PUBLIC_CORS_PATHS = new Set(["/events", "/geocode/address-suggestions"]);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
