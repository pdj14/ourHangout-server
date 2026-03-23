import type { FastifyInstance } from 'fastify';
import { AppError, ErrorCodes } from '../../lib/errors';
import { AppUpdatesService } from './app-updates.service';

export async function guardianAppUpdatesRoutes(app: FastifyInstance): Promise<void> {
  const service = new AppUpdatesService(app.log);
  const guardianAuth = { preHandler: app.authenticateGuardian };

  app.get(
    '/',
    {
      ...guardianAuth,
      schema: {
        tags: ['guardian'],
        summary: 'List published Android app updates for Guardian Console'
      }
    },
    async () => {
      const data = await service.listReleases();
      return { success: true, data };
    }
  );

  app.put(
    '/',
    {
      ...guardianAuth,
      schema: {
        tags: ['guardian'],
        summary: 'Upload and publish the latest Android APK for Guardian Console',
        headers: {
          type: 'object',
          required: ['x-app-version'],
          properties: {
            'content-type': { type: 'string', minLength: 1, maxLength: 120 },
            'x-app-version': { type: 'string', minLength: 1, maxLength: 64 },
            'x-app-notes': { type: 'string', maxLength: 2000 },
            'x-app-file-name': { type: 'string', maxLength: 255 }
          }
        }
      }
    },
    async (request) => {
      if (!Buffer.isBuffer(request.body)) {
        throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Binary request body is required.');
      }

      const headers = request.headers as Record<string, string | string[] | undefined>;
      const version = String(headers['x-app-version'] || '').trim();
      const notes = String(headers['x-app-notes'] || '').trim();
      const fileName = String(headers['x-app-file-name'] || '').trim();
      const mimeType = String(headers['content-type'] || '').trim();

      const data = await service.uploadRelease({
        version,
        notes,
        fileName,
        mimeType,
        bytes: request.body
      });

      return { success: true, data };
    }
  );
}
