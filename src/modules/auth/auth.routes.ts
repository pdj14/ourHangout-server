import type { FastifyInstance } from 'fastify';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/signup',
    {
      schema: {
        tags: ['auth'],
        summary: 'Sign up with email and password',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            role: { type: 'string', enum: ['parent', 'user'], default: 'user' },
            displayName: { type: 'string', minLength: 1, maxLength: 100 }
          }
        }
      }
    },
    async (request) => {
      const body = request.body as {
        email: string;
        password: string;
        role?: 'parent' | 'user';
        displayName?: string;
      };

      const data = await app.authService.signup({
        email: body.email,
        password: body.password,
        role: body.role ?? 'user',
        displayName: body.displayName
      });

      return { success: true, data };
    }
  );

  app.post(
    '/google',
    {
      schema: {
        tags: ['auth'],
        summary: 'Login or sign up with Google ID token',
        body: {
          type: 'object',
          required: ['idToken'],
          properties: {
            idToken: { type: 'string', minLength: 20 },
            role: { type: 'string', enum: ['parent', 'user'], default: 'user' }
          }
        }
      }
    },
    async (request) => {
      const body = request.body as {
        idToken: string;
        role?: 'parent' | 'user';
      };

      const data = await app.authService.loginWithGoogle({
        idToken: body.idToken,
        role: body.role ?? 'user'
      });

      return { success: true, data };
    }
  );

  app.post(
    '/link/google',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['auth'],
        summary: 'Link Google account to current signed-in user',
        body: {
          type: 'object',
          required: ['idToken'],
          properties: {
            idToken: { type: 'string', minLength: 20 }
          }
        }
      }
    },
    async (request) => {
      const body = request.body as { idToken: string };
      const data = await app.authService.linkGoogleAccount(request.user.sub, body.idToken);
      return { success: true, data };
    }
  );

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
        summary: 'Revoke one refresh token',
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

  app.post(
    '/logout-all',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['auth'],
        summary: 'Revoke all refresh tokens for current user'
      }
    },
    async (request) => {
      await app.authService.logoutAll(request.user.sub);
      return { success: true };
    }
  );

  app.post(
    '/change-password',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['auth'],
        summary: 'Change password and revoke existing sessions',
        body: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string', minLength: 8 },
            newPassword: { type: 'string', minLength: 8 }
          }
        }
      }
    },
    async (request) => {
      const body = request.body as {
        currentPassword: string;
        newPassword: string;
      };

      await app.authService.changePassword({
        userId: request.user.sub,
        currentPassword: body.currentPassword,
        newPassword: body.newPassword
      });

      return { success: true };
    }
  );

  app.put(
    '/profile/phone',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['auth'],
        summary: 'Set or clear phone number in E.164 format',
        body: {
          type: 'object',
          properties: {
            phone: { type: ['string', 'null'], minLength: 8, maxLength: 20 }
          }
        }
      }
    },
    async (request) => {
      const body = (request.body as { phone?: string | null } | undefined) ?? {};
      const data = await app.authService.updatePhone(request.user.sub, body.phone ?? null);
      return { success: true, data };
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
