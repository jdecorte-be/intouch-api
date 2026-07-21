import { Controller, Get, Res } from "@nestjs/common";
import type { Response } from "express";

import { PrismaService } from "../prisma/prisma.service";

type CheckStatus = "ok" | "unavailable";

type HealthCheck = {
  status: CheckStatus;
  responseTimeMs?: number;
  statusCode?: number;
  error?: string;
};

const HEALTHCHECK_TIMEOUT_MS = 1500;
const DATABASE_TIMEOUT_MS = 1200;

function getUmamiHealthcheckUrl() {
  const value = process.env.UMAMI_HEALTHCHECK_URL?.trim();
  return value ? value : null;
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTHCHECK_TIMEOUT_MS);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function checkUmami(url: string): Promise<HealthCheck> {
  const start = performance.now();

  try {
    const response = await fetchWithTimeout(url);
    return { status: response.ok ? "ok" : "unavailable", responseTimeMs: Math.round(performance.now() - start), statusCode: response.status };
  } catch (error) {
    return {
      status: "unavailable",
      responseTimeMs: Math.round(performance.now() - start),
      error: error instanceof Error ? error.name : "UnknownError",
    };
  }
}

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  private async checkDatabase(): Promise<HealthCheck> {
    const start = performance.now();

    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => setTimeout(() => reject(new Error("DatabaseTimeout")), DATABASE_TIMEOUT_MS)),
      ]);

      return { status: "ok", responseTimeMs: Math.round(performance.now() - start) };
    } catch (error) {
      return {
        status: "unavailable",
        responseTimeMs: Math.round(performance.now() - start),
        error: error instanceof Error ? error.message : "UnknownError",
      };
    }
  }

  @Get()
  async check(@Res({ passthrough: true }) res: Response) {
    const umamiUrl = getUmamiHealthcheckUrl();
    const [database, umami] = await Promise.all([this.checkDatabase(), umamiUrl ? checkUmami(umamiUrl) : Promise.resolve(undefined)]);
    const status = database.status === "unavailable" || umami?.status === "unavailable" ? "degraded" : "ok";

    res.status(status === "ok" ? 200 : 503);
    res.setHeader("Cache-Control", "no-store");

    return {
      status,
      service: "retalk-api",
      timestamp: new Date().toISOString(),
      checks: {
        app: { status: "ok" },
        database,
        ...(umami ? { umami } : {}),
      },
    };
  }
}
