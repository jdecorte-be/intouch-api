import type { Request, Response } from 'express';
import { verifySession } from 'supertokens-node/recipe/session/framework/express';
import type { SessionRequest } from 'supertokens-node/framework/express';

// Shared by BearerAuthGuard and AdminGuard: runs SuperTokens' session
// verification (validates/refreshes the access token, throws a
// SuperTokensError the app's global HttpExceptionFilter knows how to turn
// into a 401 when there's no valid session) and returns the verified user id.
export async function verifySupertokensSession(
  request: Request,
  response: Response,
): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    void verifySession()(
      request as SessionRequest,
      response,
      (err?: unknown) => {
        if (err) {
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- err is the SuperTokensError verifySession passed to next(); wrapping it would break the exception filter's isErrorFromSuperTokens check.
          reject(err);
          return;
        }

        resolve();
      },
    );
  });

  return (request as SessionRequest).session!.getUserId();
}
