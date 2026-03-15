import { promises as fs } from 'fs';
import { relative, resolve } from 'path';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { env } from '../../config/env';
import { AppError, ErrorCodes } from '../../lib/errors';

const guardianConsoleRoot = resolve(process.cwd(), 'guardian-console');

function resolveGuardianFile(relativePath: string): string {
  const absolutePath = resolve(guardianConsoleRoot, relativePath);
  const relativeToRoot = relative(guardianConsoleRoot, absolutePath);

  if (!relativeToRoot || relativeToRoot.startsWith('..')) {
    throw new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Invalid Guardian Console file path.');
  }

  return absolutePath;
}

async function sendStaticFile(reply: FastifyReply, relativePath: string, contentType: string): Promise<FastifyReply> {
  const filePath = resolveGuardianFile(relativePath);

  let body: Buffer;
  try {
    body = await fs.readFile(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new AppError(404, ErrorCodes.RESOURCE_NOT_FOUND, 'Guardian Console asset not found.');
    }

    throw error;
  }

  reply.header('Cache-Control', 'no-cache');
  return reply.type(contentType).send(body);
}

export async function guardianConsoleRoutes(app: FastifyInstance): Promise<void> {
  app.get('/guardian', async (_request, reply) => sendStaticFile(reply, 'index.html', 'text/html; charset=utf-8'));
  app.get('/guardian/', async (_request, reply) => sendStaticFile(reply, 'index.html', 'text/html; charset=utf-8'));
  app.get('/guardian/assets/runtime-config.js', async (_request, reply) => {
    const body = `window.__GUARDIAN_CONFIG__ = ${JSON.stringify({
      googleClientId: env.GOOGLE_CLIENT_IDS[0] ?? '',
      guardianMasterEmails: env.GUARDIAN_MASTER_EMAILS
    })};`;

    reply.header('Cache-Control', 'no-cache');
    return reply.type('application/javascript; charset=utf-8').send(body);
  });
  app.get('/guardian/assets/styles.css', async (_request, reply) =>
    sendStaticFile(reply, 'assets/styles.css', 'text/css; charset=utf-8')
  );
  app.get('/guardian/assets/app.js', async (_request, reply) =>
    sendStaticFile(reply, 'assets/app.js', 'application/javascript; charset=utf-8')
  );
}
