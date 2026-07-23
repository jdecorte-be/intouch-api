import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { User } from "@prisma/client";

import { getDefaultAvatarUrl } from "../common/format/format.util";
import { MailerService } from "../common/mailer/mailer.service";
import { PasswordService } from "../common/password/password.service";
import { PrismaService } from "../prisma/prisma.service";

export type AuthServiceError = "CredentialsMissing" | "CredentialsInvalid" | "PasswordTooShort" | "EmailAlreadyRegistered";

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === "P2002";
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

// Thrown-and-mapped version of the error union the original app returned
// as a plain `{ ok: false, error }` result. Keeping the same error codes
// (and the same 401/409/400 status mapping) preserves the API contract
// mobile clients already rely on, and preserves the anti-enumeration
// behavior in authenticate() (missing user / wrong password / OAuth-only
// account all collapse to the same "CredentialsInvalid" 401).
export class AuthServiceException extends Error {
  constructor(public readonly code: AuthServiceError) {
    super(code);
  }
}

// A scrypt hash of an unguessable placeholder, used to keep authenticate()'s
// timing constant whether or not the account exists — otherwise a missing
// user short-circuits before password.verify() runs, letting an attacker
// distinguish "no such account" from "wrong password" by response time.
const DUMMY_PASSWORD_HASH =
  "a9add1a2b11dca4b588ef0a0c292f065:c02659834198d78bd7f2ed2935a02e1f39f91a0ca3f4b008d2022664304c257e2f4fa416fd44d479ca049443746e226a0828d161eb9a446794ea8d3f4739e09b";

function toHttpException(code: AuthServiceError): Error {
  if (code === "CredentialsInvalid") return new UnauthorizedException(code);
  if (code === "EmailAlreadyRegistered") return new ConflictException(code);
  return new BadRequestException(code);
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly mailer: MailerService,
  ) {}

  async register(input: { email: string; name: string; password: string }): Promise<User> {
    const name = input.name.trim();
    const email = normalizeEmail(input.email);

    if (!name || !email || !input.password) {
      throw toHttpException("CredentialsMissing");
    }

    if (input.password.length < 8) {
      throw toHttpException("PasswordTooShort");
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          name,
          email,
          image: getDefaultAvatarUrl(email),
          passwordHash: await this.password.hash(input.password),
        },
      });

      await this.mailer.sendWelcomeEmailSafely(email, name);

      return user;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw toHttpException("EmailAlreadyRegistered");
      }

      throw error;
    }
  }

  async authenticate(input: { email: string; password: string }): Promise<User> {
    const email = normalizeEmail(input.email);

    if (!email || !input.password) {
      throw toHttpException("CredentialsMissing");
    }

    const user = await this.prisma.user.findUnique({ where: { email } });

    // Always run verify(), even when there's no real hash to check against,
    // so the response time doesn't reveal whether the account exists.
    const isValidPassword = await this.password.verify(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

    if (!user?.passwordHash || user.bannedAt || !isValidPassword) {
      throw toHttpException("CredentialsInvalid");
    }

    return user;
  }

  async handleGoogleProfile(profile: { email: string; emailVerified: boolean; name?: string | null; picture?: string | null }): Promise<User> {
    const email = normalizeEmail(profile.email);

    if (!email || !profile.emailVerified) {
      throw new UnauthorizedException("Google account email is not verified");
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing?.bannedAt) {
      throw new ForbiddenException("Account banned");
    }

    if (existing) {
      // A verified Google sign-in proves ownership of this email, which may
      // belong to an account someone else pre-registered with a password.
      // Clear any existing password hash so that pre-registration can no
      // longer be used to authenticate as this user.
      return this.prisma.user.update({
        where: { email },
        data: {
          name: profile.name ?? existing.name,
          image: profile.picture ?? existing.image ?? getDefaultAvatarUrl(email),
          emailVerified: new Date(),
          passwordHash: null,
        },
      });
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        name: profile.name ?? null,
        image: profile.picture ?? getDefaultAvatarUrl(email),
        emailVerified: new Date(),
      },
    });

    await this.mailer.sendWelcomeEmailSafely(email, profile.name);

    return user;
  }
}
