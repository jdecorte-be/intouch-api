import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import supertokens from 'supertokens-node';
import { errorHandler as supertokensErrorHandler } from 'supertokens-node/framework/express';

// Preserves the existing API convention across the codebase: every error
// response body is `{ error: string }`, never a bare 500 with a stack trace.
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Errors from SuperTokens' own routes (mounted via the middleware in
    // main.ts) and from session verification in BearerAuthGuard/AdminGuard
    // (see ../../session/verify-supertokens-session.ts) both surface here —
    // hand them to SuperTokens' own handler so e.g. an expired/invalid
    // session still comes back as the 401 the frontend expects instead of a
    // generic 500.
    if (supertokens.Error.isErrorFromSuperTokens(exception)) {
      const next: NextFunction = (err) => {
        if (err) {
          this.logger.error(err instanceof Error ? err.stack : err);
          response
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .json({ error: 'Internal server error' });
        }
      };

      await supertokensErrorHandler()(exception, request, response, next);
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ??
            exception.message);

      // `error` stays a single string; per-field validation messages are
      // also returned as `details` so clients don't have to split it.
      response
        .status(status)
        .json(
          Array.isArray(message)
            ? { error: message.join(', '), details: message }
            : { error: message },
        );
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : exception);
    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ error: 'Internal server error' });
  }
}
