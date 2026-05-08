import type { FastifyPluginAsync } from 'fastify';
import { APP_NAME, API_PREFIX, type HealthResponse } from '@trinitywar/shared';

export const systemRoutes: FastifyPluginAsync = async (server) => {
  server.get<{ Reply: HealthResponse }>(`${API_PREFIX}/health`, {
    schema: {
      tags: ['system'],
      summary: 'Health check',
      response: {
        200: {
          type: 'object',
          properties: {
            app: { type: 'string' },
            status: { type: 'string', enum: ['ok'] },
            now: { type: 'string', format: 'date-time' },
          },
          required: ['app', 'status', 'now'],
        },
      },
    },
  }, async () => {
    return {
      app: APP_NAME,
      status: 'ok',
      now: new Date().toISOString(),
    };
  });
};