import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

export const swaggerPlugin = fp(async (app) => {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Our Hangout Backend API',
        version: '0.1.0',
        description: 'Backend API for Our Hangout app with OpenClaw bridge adapter.'
      },
      tags: [
        { name: 'auth', description: 'Authentication and token lifecycle' },
        { name: 'pairing', description: 'One-time device pairing codes' },
        { name: 'chat', description: '1:1 rooms, messages, and ACK handling' },
        { name: 'openclaw', description: 'OpenClaw provider diagnostics and test routes' },
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
