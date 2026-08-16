import supertokens from 'supertokens-node';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import Session from 'supertokens-node/recipe/session';
import ThirdParty from 'supertokens-node/recipe/thirdparty';

import { getDefaultAvatarUrl } from '../common/format/format.util';
import type { MailerService } from '../common/mailer/mailer.service';
import type { PasswordService } from '../common/password/password.service';
import type { PrismaService } from '../prisma/prisma.service';

// SuperTokens only has one tenant configured for this app.
const TENANT_ID = 'public';

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function stringFormFieldValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export type SupertokensDeps = {
  prisma: PrismaService;
  password: PasswordService;
  mailer: MailerService;
};

// Wires SuperTokens' EmailPassword/ThirdParty(Google)/Session recipes to
// this app's existing Prisma `User` table, which stays the single source of
// truth for profile data (name, image, role, bannedAt, ...) — SuperTokens
// only owns credentials and session tokens. Recipe user ids become the
// Prisma `User.id` going forward (see the two override blocks below), so
// every other table's foreign keys into `users` keep working unmodified.
export function initSupertokens({ prisma, password, mailer }: SupertokensDeps) {
  supertokens.init({
    appInfo: {
      appName: 'InTouch',
      apiDomain: (process.env.APP_BASE_URL ?? 'http://localhost:4000').replace(
        /\/$/,
        '',
      ),
      websiteDomain: (
        process.env.WEB_APP_URL ??
        process.env.APP_BASE_URL ??
        'http://localhost:3000'
      ).replace(/\/$/, ''),
      apiBasePath: '/auth',
    },
    supertokens: {
      connectionURI: process.env.SUPERTOKENS_CONNECTION_URI ?? '',
      apiKey: process.env.SUPERTOKENS_API_KEY,
    },
    recipeList: [
      EmailPassword.init({
        signUpFeature: {
          formFields: [{ id: 'name' }],
        },
        emailDelivery: {
          override: (originalImplementation) => ({
            ...originalImplementation,
            sendEmail: async (input) => {
              if (input.type === 'PASSWORD_RESET') {
                await mailer.sendPasswordResetEmail(
                  input.user.email,
                  input.passwordResetLink,
                );
                return;
              }

              await originalImplementation.sendEmail(input);
            },
          }),
        },
        override: {
          apis: (originalImplementation) => ({
            ...originalImplementation,

            signUpPOST: async (input) => {
              if (originalImplementation.signUpPOST === undefined) {
                throw new Error('signUpPOST is not available');
              }

              const email = normalizeEmail(
                stringFormFieldValue(
                  input.formFields.find((field) => field.id === 'email')?.value,
                ),
              );
              const bannedExisting = await prisma.user.findUnique({
                where: { email },
              });

              if (bannedExisting?.bannedAt) {
                return {
                  status: 'SIGN_UP_NOT_ALLOWED',
                  reason: 'Account banned',
                };
              }

              const response = await originalImplementation.signUpPOST(input);

              if (response.status === 'OK') {
                const nameField = input.formFields.find(
                  (field) => field.id === 'name',
                );
                const name =
                  typeof nameField?.value === 'string'
                    ? nameField.value.trim()
                    : '';
                const userEmail = response.user.emails[0] ?? email;

                await prisma.user.create({
                  data: {
                    id: response.user.id,
                    name: name || null,
                    email: userEmail,
                    image: getDefaultAvatarUrl(userEmail),
                    emailVerified: null,
                  },
                });

                await mailer.sendWelcomeEmailSafely(userEmail, name);
              }

              return response;
            },

            signInPOST: async (input) => {
              if (originalImplementation.signInPOST === undefined) {
                throw new Error('signInPOST is not available');
              }

              const response = await originalImplementation.signInPOST(input);

              if (response.status === 'WRONG_CREDENTIALS_ERROR') {
                const migrated = await tryLazyLegacyPasswordMigration(input, {
                  prisma,
                  password,
                });

                if (migrated) {
                  return migrated;
                }

                return response;
              }

              if (response.status === 'OK') {
                const user = await prisma.user.findUnique({
                  where: { id: response.user.id },
                });

                if (user?.bannedAt) {
                  return {
                    status: 'SIGN_IN_NOT_ALLOWED' as const,
                    reason: 'Account banned',
                  };
                }
              }

              return response;
            },
          }),
        },
      }),

      ThirdParty.init({
        signInAndUpFeature: {
          providers: [
            {
              config: {
                thirdPartyId: 'google',
                clients: [
                  {
                    clientId: process.env.AUTH_GOOGLE_ID ?? '',
                    clientSecret: process.env.AUTH_GOOGLE_SECRET ?? '',
                  },
                ],
              },
            },
          ],
        },
        override: {
          functions: (originalImplementation) => ({
            ...originalImplementation,

            signInUp: async (input) => {
              const response = await originalImplementation.signInUp(input);

              if (response.status !== 'OK') {
                return response;
              }

              const email = normalizeEmail(response.user.emails[0] ?? '');

              if (!email) {
                return response;
              }

              const rawUserInfo = response.rawUserInfoFromProvider
                ?.fromUserInfoAPI as
                { name?: string; picture?: string } | undefined;

              const existingByEmail = await prisma.user.findUnique({
                where: { email },
              });

              if (existingByEmail?.bannedAt) {
                return {
                  status: 'SIGN_IN_UP_NOT_ALLOWED' as const,
                  reason: 'Account banned',
                };
              }

              if (existingByEmail && existingByEmail.id !== response.user.id) {
                // This email already has a Prisma user (created via the
                // password flow, or a previous Google sign-in that got a
                // different recipe user id). Map the new recipe user id onto
                // the existing app user id so the session this call is about
                // to create resolves to the one account everything else
                // (events, chats, ...) already points at.
                await supertokens.createUserIdMapping({
                  superTokensUserId: response.user.id,
                  externalUserId: existingByEmail.id,
                });

                await prisma.user.update({
                  where: { id: existingByEmail.id },
                  data: {
                    name: rawUserInfo?.name ?? existingByEmail.name,
                    image:
                      rawUserInfo?.picture ??
                      existingByEmail.image ??
                      getDefaultAvatarUrl(email),
                    emailVerified: existingByEmail.emailVerified ?? new Date(),
                    // A verified Google sign-in proves ownership of this
                    // email, which may belong to an account someone else
                    // pre-registered with a password. Clear any existing
                    // password hash so that pre-registration can no longer
                    // be used to authenticate as this user.
                    passwordHash: null,
                  },
                });

                return response;
              }

              await prisma.user.upsert({
                where: { id: response.user.id },
                create: {
                  id: response.user.id,
                  email,
                  name: rawUserInfo?.name ?? null,
                  image: rawUserInfo?.picture ?? getDefaultAvatarUrl(email),
                  emailVerified: new Date(),
                },
                update: {
                  name: rawUserInfo?.name ?? existingByEmail?.name,
                  image:
                    rawUserInfo?.picture ??
                    existingByEmail?.image ??
                    getDefaultAvatarUrl(email),
                },
              });

              if (response.createdNewRecipeUser) {
                await mailer.sendWelcomeEmailSafely(email, rawUserInfo?.name);
              }

              return response;
            },
          }),
        },
      }),

      Session.init(),
    ],
  });
}

// Existing accounts registered before the SuperTokens cutover have password
// hashes in our own scrypt format, which SuperTokens' sign-in doesn't know
// how to verify (and its bulk-import API only accepts bcrypt/argon2/firebase
// hashes, none of which match our format). Rather than a big-bang backfill,
// migrate each account lazily the next time its owner successfully signs in
// with their existing password: verify against the legacy hash, create the
// equivalent SuperTokens credential, map it onto the existing app user id so
// every other table's foreign keys keep working, and clear the legacy hash
// so this path only ever runs once per account.
async function tryLazyLegacyPasswordMigration(
  input: {
    formFields: { id: string; value: unknown }[];
    tenantId: string;
    options: { req: unknown; res: unknown };
  },
  { prisma, password }: { prisma: PrismaService; password: PasswordService },
) {
  const email = normalizeEmail(
    stringFormFieldValue(
      input.formFields.find((field) => field.id === 'email')?.value,
    ),
  );
  const suppliedPassword = stringFormFieldValue(
    input.formFields.find((field) => field.id === 'password')?.value,
  );

  if (!email || !suppliedPassword) {
    return null;
  }

  const legacyUser = await prisma.user.findUnique({ where: { email } });

  if (!legacyUser?.passwordHash || legacyUser.bannedAt) {
    return null;
  }

  const isValidLegacyPassword = await password.verify(
    suppliedPassword,
    legacyUser.passwordHash,
  );

  if (!isValidLegacyPassword) {
    return null;
  }

  const created = await EmailPassword.signUp(
    TENANT_ID,
    email,
    suppliedPassword,
  );

  if (created.status !== 'OK') {
    // Extremely unlikely (would mean a SuperTokens credential for this
    // email already exists despite the normal sign-in above reporting wrong
    // credentials) — fall back to the normal wrong-credentials response.
    return null;
  }

  await supertokens.createUserIdMapping({
    superTokensUserId: created.user.id,
    externalUserId: legacyUser.id,
  });

  await prisma.user.update({
    where: { id: legacyUser.id },
    data: { passwordHash: null },
  });

  const session = await Session.createNewSession(
    input.options.req,
    input.options.res,
    TENANT_ID,
    created.recipeUserId,
  );

  return { status: 'OK' as const, user: created.user, session };
}
