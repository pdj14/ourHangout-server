import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppError, ErrorCodes, isAppError } from '../lib/errors';
import { isGuardianConsoleTokenPayload } from '../modules/guardian/guardian.auth';
import { env } from '../config/env';

function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
): FastifyReply {
  return reply.code(statusCode).send({
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {})
    }
  });
}

function sanitizeRequestUrl(url: string): string {
  return url.split('?', 1)[0];
}

export function registerErrorHandlers(app: FastifyInstance): void {
  app.setErrorHandler((error, request: FastifyRequest, reply: FastifyReply) => {
    if (isAppError(error)) {
      if (error.statusCode >= 500) {
        request.log.error({ error }, 'Request failed');
      }
      sendError(reply, error.statusCode, error.code, error.message, error.details);
      return;
    }

    if ((error as { validation?: unknown }).validation) {
      sendError(
        reply,
        400,
        ErrorCodes.VALIDATION_ERROR,
        'Request validation failed.',
        (error as { validation?: unknown }).validation
      );
      return;
    }

    if ((error as { code?: string }).code?.startsWith('FST_JWT_')) {
      sendError(reply, 401, ErrorCodes.AUTH_UNAUTHORIZED, 'Invalid or expired access token.');
      return;
    }

    if ((error as { statusCode?: number }).statusCode === 429) {
      sendError(reply, 429, ErrorCodes.RATE_LIMITED, 'Too many requests.');
      return;
    }

    request.log.error({ error }, 'Request failed');
    sendError(reply, 500, ErrorCodes.INTERNAL_ERROR, 'Internal server error.');
  });

  app.setNotFoundHandler((request, reply) => {
    sendError(
      reply,
      404,
      ErrorCodes.RESOURCE_NOT_FOUND,
      `Route not found: ${request.method} ${sanitizeRequestUrl(request.url)}`
    );
  });

  app.decorate('authenticate', async (request: FastifyRequest) => {
    try {
      await request.jwtVerify();
    } catch {
      throw new AppError(401, ErrorCodes.AUTH_UNAUTHORIZED, 'Authentication required.');
    }

    if (isGuardianConsoleTokenPayload(request.user)) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, 'Guardian Console tokens cannot access app user routes.');
    }
  });

  app.decorate('authenticateGuardian', async (request: FastifyRequest) => {
    if (!env.GUARDIAN_CONSOLE_ENABLED) {
      throw new AppError(503, ErrorCodes.FORBIDDEN, 'Guardian Console is disabled.');
    }

    try {
      await request.jwtVerify();
    } catch {
      throw new AppError(401, ErrorCodes.AUTH_UNAUTHORIZED, 'Guardian Console authentication required.');
    }

    if (!isGuardianConsoleTokenPayload(request.user)) {
      throw new AppError(403, ErrorCodes.FORBIDDEN, 'Only configured Guardian Console credentials can access this page.');
    }
  });
}
