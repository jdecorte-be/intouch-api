import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import type { Request, Response } from 'express';
import EmailPassword from 'supertokens-node/recipe/emailpassword';

import { serializeSessionUser } from '../common/format/format.util';
import { MailerService } from '../common/mailer/mailer.service';
import { PrismaService } from '../prisma/prisma.service';
import { BearerAuthGuard } from '../session/bearer-auth.guard';
import { CurrentUser } from '../session/current-user.decorator';
import { OnboardingDto, UpdateAccountDto } from './dto/auth.dto';

const MOBILE_AUTH_DEEP_LINK = 'intouchapp://auth-callback';

// Sign up, sign in, sign out, Google OAuth, and forgot-password are all
// handled by SuperTokens' own default routes (mounted under /auth by the
// middleware in main.ts — see ../supertokens/supertokens.config.ts). This
// controller only covers the app-specific bits SuperTokens doesn't know
// about: reading/updating the enriched Prisma profile.
@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {}

  // Google's OAuth client only accepts https redirect URIs, so the mobile
  // app can't ask Google to land straight on its intouchapp:// deep link.
  // This is the https address Google is allowed to redirect to; it just
  // forwards Google's query params (code, state, error, ...) on to the app
  // unchanged via a real HTTP redirect.
  @Get('mobile-callback')
  mobileCallback(@Req() req: Request, @Res() res: Response) {
    const target = new URL(MOBILE_AUTH_DEEP_LINK);

    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        target.searchParams.set(key, value);
      }
    }

    res.redirect(target.toString());
  }

  @Get('session')
  @UseGuards(BearerAuthGuard)
  @HttpCode(200)
  session(@CurrentUser() user: User) {
    return { user: serializeSessionUser(user) };
  }

  @Patch('onboarding')
  @UseGuards(BearerAuthGuard)
  @HttpCode(200)
  async completeOnboarding(
    @CurrentUser() user: User,
    @Body() dto: OnboardingDto,
  ) {
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(dto.name?.trim() ? { name: dto.name.trim() } : {}),
        ...(dto.age !== undefined ? { age: dto.age } : {}),
        ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
        ...(dto.image !== undefined ? { image: dto.image } : {}),
        languagesSpoken: dto.languagesSpoken ?? [],
        photos: dto.photos ?? [],
        homeNeighborhood: dto.homeNeighborhood?.trim() || null,
        homeLatitude: dto.homeLatitude ?? null,
        homeLongitude: dto.homeLongitude ?? null,
        eventInterests: dto.eventInterests ?? [],
        eventGoals: dto.eventGoals ?? [],
        onboardingCompletedAt: new Date(),
      },
    });

    return { user: serializeSessionUser(updated) };
  }

  @Patch('account')
  @UseGuards(BearerAuthGuard)
  @HttpCode(200)
  async updateAccount(
    @CurrentUser() user: User,
    @Body() dto: UpdateAccountDto,
  ) {
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        name: dto.name?.trim() || null,
        ...(dto.age !== undefined ? { age: dto.age } : {}),
        ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
        ...(dto.image !== undefined ? { image: dto.image } : {}),
        languagesSpoken: dto.languagesSpoken ?? [],
        photos: dto.photos ?? [],
        homeNeighborhood: dto.homeNeighborhood?.trim() || null,
        homeLatitude: dto.homeLatitude ?? null,
        homeLongitude: dto.homeLongitude ?? null,
        eventInterests: dto.eventInterests ?? [],
        eventGoals: dto.eventGoals ?? [],
      },
    });

    return { saved: true };
  }

  @Post('account/password-reset')
  @UseGuards(BearerAuthGuard)
  @HttpCode(200)
  async requestAccountPasswordReset(@CurrentUser() user: User) {
    const email = user.email?.trim().toLowerCase();

    if (!email) {
      return {
        sent: false,
        error:
          'Add an email address to your account before resetting your password.',
      };
    }

    const linkResult = await EmailPassword.createResetPasswordLink(
      'public',
      user.id,
      email,
    );

    if (linkResult.status !== 'OK') {
      return {
        sent: false,
        error:
          "We couldn't send a reset link right now. Try again in a moment.",
      };
    }

    try {
      await this.mailer.sendPasswordResetEmail(email, linkResult.link);
    } catch {
      return {
        sent: false,
        error:
          "We couldn't send a reset link right now. Try again in a moment.",
      };
    }

    return { sent: true };
  }
}
