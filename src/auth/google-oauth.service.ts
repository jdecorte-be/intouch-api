import { Injectable, InternalServerErrorException } from "@nestjs/common";

const authorizeUrl = "https://accounts.google.com/o/oauth2/v2/auth";
const tokenUrl = "https://oauth2.googleapis.com/token";
const userinfoUrl = "https://openidconnect.googleapis.com/v1/userinfo";

export type GoogleProfile = {
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
};

@Injectable()
export class GoogleOAuthService {
  private get clientId() {
    return process.env.AUTH_GOOGLE_ID ?? "";
  }

  private get clientSecret() {
    return process.env.AUTH_GOOGLE_SECRET ?? "";
  }

  private get redirectUri() {
    return process.env.GOOGLE_CALLBACK_URL ?? `${process.env.APP_BASE_URL}/auth/google/callback`;
  }

  buildAuthorizeUrl(state: string) {
    const url = new URL(authorizeUrl);
    url.searchParams.set("client_id", this.clientId);
    url.searchParams.set("redirect_uri", this.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("access_type", "online");
    url.searchParams.set("prompt", "select_account");
    url.searchParams.set("state", state);

    return url.toString();
  }

  async exchangeCodeForProfile(code: string): Promise<GoogleProfile> {
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      throw new InternalServerErrorException("Failed to exchange Google authorization code");
    }

    const tokenBody = (await tokenResponse.json()) as { access_token?: string };

    if (!tokenBody.access_token) {
      throw new InternalServerErrorException("Google did not return an access token");
    }

    const userinfoResponse = await fetch(userinfoUrl, {
      headers: { Authorization: `Bearer ${tokenBody.access_token}` },
    });

    if (!userinfoResponse.ok) {
      throw new InternalServerErrorException("Failed to fetch Google profile");
    }

    const profile = (await userinfoResponse.json()) as {
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };

    if (!profile.email) {
      throw new InternalServerErrorException("Google profile did not include an email");
    }

    return {
      email: profile.email,
      emailVerified: profile.email_verified === true,
      name: profile.name,
      picture: profile.picture,
    };
  }
}
