import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import { APP_NAME, DOCS_ROUTE } from '@trinitywar/shared';

export const registerSwagger = async (server: FastifyInstance): Promise<void> => {
  await server.register(swagger, {
    openapi: {
      info: {
        title: `${APP_NAME} API`,
        description: 'TrinityWar client and admin API documentation.',
        version: '0.1.0',
      },
      tags: [
        { name: 'system', description: 'System endpoints' },
        { name: 'client', description: 'WeChat mini game client endpoints' },
        { name: 'admin', description: 'Admin console endpoints' },
      ],
    },
  });

  await server.register(swaggerUi, {
    routePrefix: DOCS_ROUTE,
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    staticCSP: true,
  });
};