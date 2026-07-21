import { Injectable, Logger } from "@nestjs/common";

const resendApiUrl = "https://api.resend.com/emails";

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  missingApiKeyMessage?: string;
};

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  private async sendEmail({ to, subject, text, missingApiKeyMessage }: EmailMessage) {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      this.logger.log(missingApiKeyMessage ?? `RESEND_API_KEY is not set. Skipping email to ${to}: ${subject}`);
      return;
    }

    const response = await fetch(resendApiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "ReTalk <onboarding@resend.dev>",
        to: [to],
        subject,
        text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send email: ${response.status} ${await response.text()}`);
    }
  }

  async sendPasswordResetEmail(email: string, resetUrl: string) {
    await this.sendEmail({
      to: email,
      subject: "Reset your ReTalk password",
      text: [
        "We received a request to reset the password for your ReTalk account.",
        "",
        `Reset your password: ${resetUrl}`,
        "",
        "This link expires in 1 hour. If you didn't request a reset, you can safely ignore this email.",
      ].join("\n"),
      missingApiKeyMessage: `RESEND_API_KEY is not set. Password reset link for ${email}: ${resetUrl}`,
    });
  }

  async sendWelcomeEmail(email: string, name?: string | null) {
    const greeting = name ? `Hi ${name},` : "Hi,";

    await this.sendEmail({
      to: email,
      subject: "Welcome to ReTalk",
      text: [
        greeting,
        "",
        "Your ReTalk account has been created.",
        "",
        "You can now discover nearby events, save plans, and join conversations around local happenings.",
        "",
        "Thanks for joining ReTalk.",
      ].join("\n"),
    });
  }

  async sendWelcomeEmailSafely(email: string, name?: string | null) {
    try {
      await this.sendWelcomeEmail(email, name);
    } catch (error) {
      this.logger.error("Failed to send welcome email", error instanceof Error ? error.stack : error);
    }
  }
}
