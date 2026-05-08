import type { FastifyPluginAsync } from 'fastify';
import { APP_NAME, CLIENT_API_PREFIX, type ClientBootstrapResponse } from '@trinitywar/shared';

export const clientRoutes: FastifyPluginAsync = async (server) => {
  server.get<{ Reply: ClientBootstrapResponse }>(`${CLIENT_API_PREFIX}/bootstrap`, {
    schema: {
      tags: ['client'],
      summary: 'Client bootstrap payload',
      description: 'Provides the minimal boot information required by the mini game client.',
      response: {
        200: {
          type: 'object',
          properties: {
            app: { type: 'string' },
            env: { type: 'string', enum: ['local'] },
            version: { type: 'string' },
            serverTime: { type: 'string', format: 'date-time' },
          },
          required: ['app', 'env', 'version', 'serverTime'],
        },
      },
    },
  }, async () => {
    return {
      app: APP_NAME,
      env: 'local',
      version: '0.1.0',
      serverTime: new Date().toISOString(),
    };
  });
};