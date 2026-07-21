export const oauthProviders = [
  {
    id: "google",
    name: "Google",
    clientIdEnv: "AUTH_GOOGLE_ID",
    clientSecretEnv: "AUTH_GOOGLE_SECRET",
  },
] as const;

export type OAuthProviderId = (typeof oauthProviders)[number]["id"];

export function isOAuthProviderId(value: unknown): value is OAuthProviderId {
  return oauthProviders.some((provider) => provider.id === value);
}

export function isOAuthProviderConfigured(providerId: OAuthProviderId) {
  const provider = oauthProviders.find(({ id }) => id === providerId);

  return Boolean(provider && process.env[provider.clientIdEnv] && process.env[provider.clientSecretEnv]);
}
