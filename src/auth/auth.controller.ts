import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";

import { serializeSessionUser } from "../common/format/format.util";
import { MailerService } from "../common/mailer/mailer.service";
import { PasswordService } from "../common/password/password.service";
import { isOAuthProviderConfigured } from "../common/oauth-providers";
import { PrismaService } from "../prisma/prisma.service";
import { BearerAuthGuard } from "../session/bearer-auth.guard";
import { getBearerToken } from "../session/bearer-token.util";
import { CurrentUser } from "../session/current-user.decorator";
import { SessionService } from "../session/session.service";
import { AuthService, normalizeEmail } from "./auth.service";
import {
  ConfirmPasswordResetDto,
  LoginDto,
  OnboardingDto,
  RegisterDto,
  RequestPasswordResetDto,
  UpdateAccountDto,
} from "./dto/auth.dto";
import { GoogleOAuthService } from "./google-oauth.service";
import { createOAuthState, type OAuthClient, verifyOAuthState } from "./oauth-state.util";
import { PasswordResetService } from "./password-reset.service";

const MOBILE_AUTH_CALLBACK_URL = `${process.env.MOBILE_AUTH_SCHEME ?? "retalkapp"}://auth-callback`;

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly mailer: MailerService,
    private readonly passwordReset: PasswordResetService,
    private readonly google: GoogleOAuthService,
  ) {}

  private async issueSession(user: Awaited<ReturnType<AuthService["register"]>>) {
    const token = await this.sessions.createSession(user.id);
    return { token, user: serializeSessionUser(user) };
  }

  private getWebBaseUrl() {
    return (process.env.WEB_APP_URL ?? process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  }

  @Post("register")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.register(dto);
    res.status(201);
    return this.issueSession(user);
  }

  @Post("login")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() dto: LoginDto) {
    const user = await this.auth.authenticate(dto);
    return this.issueSession(user);
  }

  @Get("session")
  @HttpCode(200)
  async session(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = getBearerToken(req);
    const user = token ? await this.sessions.getUserForToken(token) : null;

    if (!user) {
      res.status(401);
      return { user: null };
    }

    return { user: serializeSessionUser(user) };
  }

  @Post("logout")
  @HttpCode(200)
  async logout(@Req() req: Request) {
    const token = getBearerToken(req);

    if (token) {
      await this.sessions.deleteSession(token);
    }

    return { ok: true };
  }

  @Get("google")
  async startGoogle(@Query("client") client: string | undefined, @Res() res: Response) {
    const resolvedClient: OAuthClient = client === "mobile" ? "mobile" : "web";
    const errorTarget =
      resolvedClient === "mobile" ? MOBILE_AUTH_CALLBACK_URL : `${this.getWebBaseUrl()}/auth/callback`;

    if (!isOAuthProviderConfigured("google")) {
      res.redirect(`${errorTarget}?error=OAuthNotConfigured`);
      return;
    }

    const state = createOAuthState(resolvedClient);
    res.redirect(this.google.buildAuthorizeUrl(state));
  }

  @Get("google/callback")
  async googleCallback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") oauthError: string | undefined,
    @Res() res: Response,
  ) {
    const client = verifyOAuthState(state) ?? "web";
    const callbackTarget = client === "mobile" ? MOBILE_AUTH_CALLBACK_URL : `${this.getWebBaseUrl()}/auth/callback`;

    if (oauthError || !code) {
      res.redirect(`${callbackTarget}?error=OAuthFailed`);
      return;
    }

    try {
      const profile = await this.google.exchangeCodeForProfile(code);
      const user = await this.auth.handleGoogleProfile(profile);
      const token = await this.sessions.createSession(user.id);

      res.redirect(`${callbackTarget}?token=${encodeURIComponent(token)}`);
    } catch {
      res.redirect(`${callbackTarget}?error=OAuthFailed`);
    }
  }

  @Post("password-reset/request")
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    const email = normalizeEmail(dto.email);
    const user = email ? await this.prisma.user.findUnique({ where: { email } }) : null;

    if (user) {
      const token = await this.passwordReset.createToken(email);
      const resetUrl = `${this.getWebBaseUrl()}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

      try {
        await this.mailer.sendPasswordResetEmail(email, resetUrl);
      } catch {
        // Swallowed: still report success below so the endpoint can't be
        // used to probe which emails have accounts.
      }
    }

    // Always report success, regardless of whether the email existed.
    return { ok: true };
  }

  @Post("password-reset/confirm")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async confirmPasswordReset(@Body() dto: ConfirmPasswordResetDto) {
    const email = normalizeEmail(dto.email);

    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException("PasswordMismatch");
    }

    const isValidToken = email && dto.token ? await this.passwordReset.consumeToken(email, dto.token) : false;
    const user = isValidToken ? await this.prisma.user.findUnique({ where: { email } }) : null;

    if (!user) {
      throw new BadRequestException("ResetLinkInvalid");
    }

    await this.prisma.user.update({
      where: { email },
      data: { passwordHash: await this.password.hash(dto.password) },
    });

    return this.issueSession(user);
  }

  @Patch("onboarding")
  @UseGuards(BearerAuthGuard)
  @HttpCode(200)
  async completeOnboarding(@CurrentUser() user: { id: string }, @Body() dto: OnboardingDto) {
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(dto.name?.trim() ? { name: dto.name.trim() } : {}),
        homeNeighborhood: dto.homeNeighborhood?.trim() || null,
        eventInterests: dto.eventInterests ?? [],
        eventGoals: dto.eventGoals ?? [],
        onboardingCompletedAt: new Date(),
      },
    });

    return { user: serializeSessionUser(updated) };
  }

  @Patch("account")
  @UseGuards(BearerAuthGuard)
  @HttpCode(200)
  async updateAccount(@CurrentUser() user: { id: string }, @Body() dto: UpdateAccountDto) {
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        name: dto.name?.trim() || null,
        homeNeighborhood: dto.homeNeighborhood?.trim() || null,
        eventInterests: dto.eventInterests ?? [],
        eventGoals: dto.eventGoals ?? [],
      },
    });

    return { saved: true };
  }

  @Post("account/password-reset")
  @UseGuards(BearerAuthGuard)
  @HttpCode(200)
  async requestAccountPasswordReset(@CurrentUser() user: { id: string; email: string | null }) {
    const email = user.email?.trim().toLowerCase();

    if (!email) {
      return {
        sent: false,
        error: "Add an email address to your account before resetting your password.",
      };
    }

    const token = await this.passwordReset.createToken(email);
    const resetUrl = `${this.getWebBaseUrl()}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

    try {
      await this.mailer.sendPasswordResetEmail(email, resetUrl);
    } catch {
      return {
        sent: false,
        error: "We couldn't send a reset link right now. Try again in a moment.",
      };
    }

    return { sent: true };
  }
}
