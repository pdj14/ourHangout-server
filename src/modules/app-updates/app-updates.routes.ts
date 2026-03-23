import { createReadStream } from 'fs';
import type { FastifyInstance } from 'fastify';
import { AppUpdatesService, buildContentDispositionHeader } from './app-updates.service';

export async function appUpdatesRoutes(app: FastifyInstance): Promise<void> {
  const service = new AppUpdatesService(app.log);

  app.get(
    '/latest',
    {
      schema: {
        tags: ['app-updates'],
        summary: 'Get latest published Android app update status',
        querystring: {
          type: 'object',
          properties: {
            currentVersion: { type: 'string', minLength: 1, maxLength: 64 }
          }
        }
      }
    },
    async (request) => {
      const query = (request.query as { currentVersion?: string } | undefined) ?? {};
      const data = await service.getLatestStatus(query.currentVersion);
      return { success: true, data };
    }
  );

  app.get(
    '/download/latest',
    {
      schema: {
        tags: ['app-updates'],
        summary: 'Download the latest published Android APK'
      }
    },
    async (_request, reply) => {
      const asset = await service.getLatestDownloadAsset();
      reply.header('Content-Type', asset.mimeType);
      reply.header('Content-Length', String(asset.sizeBytes));
      reply.header('Content-Disposition', buildContentDispositionHeader(asset.fileName));
      reply.header('Cache-Control', 'no-cache');
      return reply.send(createReadStream(asset.path));
    }
  );

  app.get(
    '/files/:fileName',
    {
      schema: {
        tags: ['app-updates'],
        summary: 'Download a published Android APK by file name',
        params: {
          type: 'object',
          required: ['fileName'],
          properties: {
            fileName: { type: 'string', minLength: 1, maxLength: 255 }
          }
        }
      }
    },
    async (request, reply) => {
      const params = request.params as { fileName: string };
      const asset = await service.getDownloadAssetByFileName(params.fileName);
      reply.header('Content-Type', asset.mimeType);
      reply.header('Content-Length', String(asset.sizeBytes));
      reply.header('Content-Disposition', buildContentDispositionHeader(asset.fileName));
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      return reply.send(createReadStream(asset.path));
    }
  );
}
