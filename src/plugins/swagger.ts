import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

export const swaggerPlugin = fp(async (app) => {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Our Hangout Backend API',
        version: '0.1.0',
        description: 'Backend API for the Our Hangout family communication app.'
      },
      tags: [
        { name: 'auth', description: 'Authentication and token lifecycle' },
        { name: 'contacts', description: 'Hashed contact sync and account match lookup' },
        { name: 'pairing', description: 'One-time device pairing codes' },
        { name: 'family', description: 'Friend-to-family upgrades, family links, groups, and permissions' },
        { name: 'chat', description: '1:1 rooms, messages, and ACK handling' },
        { name: 'social', description: 'Profiles, friends, rooms, media, reports, and push token APIs' },
        { name: 'app-updates', description: 'Published Android APK version checks and download endpoints' },
        { name: 'ops', description: 'Health, readiness, and metrics endpoints' }
      ]
    }
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false
    }
  });
});
