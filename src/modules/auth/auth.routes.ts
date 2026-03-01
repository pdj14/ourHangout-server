import type { FastifyInstance } from 'fastify';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/login',
    {
      schema: {
        tags: ['auth'],
        summary: 'Login with email and password',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 }
          }
        }
      }
    },
    async (request) => {
      const body = request.body as { email: string; password: string };
      const data = await app.authService.login(body.email, body.password);
      return { success: true, data };
    }
  );

  app.post(
    '/refresh',
    {
      schema: {
        tags: ['auth'],
        summary: 'Rotate access/refresh tokens',
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string', minLength: 32 }
          }
        }
      }
    },
    async (request) => {
      const body = request.body as { refreshToken: string };
      const data = await app.authService.refresh(body.refreshToken);
      return { success: true, data };
    }
  );

  app.post(
    '/logout',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['auth'],
        summary: 'Revoke refresh token',
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string', minLength: 32 }
          }
        }
      }
    },
    async (request) => {
      const body = request.body as { refreshToken: string };
      await app.authService.logout(request.user.sub, body.refreshToken);
      return { success: true };
    }
  );

  app.get(
    '/me',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['auth'],
        summary: 'Get current user profile'
      }
    },
    async (request) => {
      const data = await app.authService.getUserById(request.user.sub);
      return { success: true, data };
    }
  );
}
