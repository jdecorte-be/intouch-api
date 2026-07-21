import { createHash, randomBytes } from "node:crypto";

import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

const resetTokenTtlMs = 60 * 60 * 1000; // 1 hour

@Injectable()
export class PasswordResetService {
  constructor(private readonly prisma: PrismaService) {}

  // Namespaced so password-reset entries can never collide with any future
  // email-verification tokens stored in the same table.
  private getIdentifier(email: string) {
    return `password-reset:${email}`;
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  async createToken(email: string) {
    const token = randomBytes(32).toString("base64url");
    const identifier = this.getIdentifier(email);

    await this.prisma.verificationToken.deleteMany({ where: { identifier } });
    await this.prisma.verificationToken.create({
      data: {
        identifier,
        token: this.hashToken(token),
        expires: new Date(Date.now() + resetTokenTtlMs),
      },
    });

    return token;
  }

  async consumeToken(email: string, token: string) {
    const identifier_token = {
      identifier: this.getIdentifier(email),
      token: this.hashToken(token),
    };

    const record = await this.prisma.verificationToken.findUnique({ where: { identifier_token } });

    if (!record) {
      return false;
    }

    await this.prisma.verificationToken.delete({ where: { identifier_token } });

    return record.expires > new Date();
  }
}
