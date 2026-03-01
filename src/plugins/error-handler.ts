import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AppError, ErrorCodes, isAppError } from '../lib/errors';

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

export function registerErrorHandlers(app: FastifyInstance): void {
  app.setErrorHandler((error, request: FastifyRequest, reply: FastifyReply) => {
    request.log.error({ error }, 'Request failed');

    if (isAppError(error)) {
      sendError(reply, error.statusCode, error.code, error.message, error.details);
      return;
    }

    if ((error as { validation?: unknown }).validation) {
      sendError(reply, 400, ErrorCodes.VALIDATION_ERROR, 'Request validation failed.',
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

    sendError(reply, 500, ErrorCodes.INTERNAL_ERROR, 'Internal server error.');
  });

  app.setNotFoundHandler((request, reply) => {
    sendError(reply, 404, ErrorCodes.RESOURCE_NOT_FOUND, `Route not found: ${request.method} ${request.url}`);
  });

  app.decorate('authenticate', async (request: FastifyRequest) => {
    try {
      await request.jwtVerify();
    } catch {
      throw new AppError(401, ErrorCodes.AUTH_UNAUTHORIZED, 'Authentication required.');
    }
  });
}
