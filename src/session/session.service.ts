import { createHash, randomBytes } from "node:crypto";

import { Injectable } from "@nestjs/common";
import type { User } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

// This is the one session mechanism for every client (web and mobile):
// an opaque bearer token, hashed and stored in the `sessions` table, with
// a sliding 30-day expiry. No JWT signing/verification involved.
const sessionTtlMs = 1000 * 60 * 60 * 24 * 30; // 30 days

// Sliding expiry only needs to be persisted once it's gotten reasonably
// stale — refreshing it on every single request would mean a DB write per
// API call for every active user. Bumping it only once a day still keeps
// active sessions from ever approaching the TTL.
const sessionRefreshThresholdMs = 1000 * 60 * 60 * 24; // 1 day

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(userId: string) {
    const token = randomBytes(32).toString("base64url");

    await this.prisma.session.create({
      data: {
        sessionToken: hashToken(token),
        userId,
        expires: new Date(Date.now() + sessionTtlMs),
      },
    });

    return token;
  }

  async getUserForToken(token: string): Promise<User | null> {
    const sessionToken = hashToken(token);
    const session = await this.prisma.session.findUnique({
      where: { sessionToken },
      include: { user: true },
    });

    if (!session) {
      return null;
    }

    if (session.expires <= new Date() || session.user.bannedAt) {
      await this.prisma.session.delete({ where: { sessionToken } }).catch(() => {});
      return null;
    }

    // Sliding expiration so active users are never signed out just for
    // being under the TTL between requests. Only actually write it once the
    // stored expiry is more than a day old, to avoid a DB write per request.
    const staleBy = session.expires.getTime() - (sessionTtlMs - sessionRefreshThresholdMs);

    if (staleBy <= Date.now()) {
      await this.prisma.session.update({
        where: { sessionToken },
        data: { expires: new Date(Date.now() + sessionTtlMs) },
      });
    }

    return session.user;
  }

  async deleteSession(token: string) {
    await this.prisma.session.delete({ where: { sessionToken: hashToken(token) } }).catch(() => {});
  }

  async deleteAllSessionsForUser(userId: string) {
    await this.prisma.session.deleteMany({ where: { userId } });
  }
}
