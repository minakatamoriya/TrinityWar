import type { FastifyPluginAsync } from 'fastify';
import { ADMIN_API_PREFIX, APP_NAME, DOCS_ROUTE, type AdminOverviewResponse } from '@trinitywar/shared';

export const adminRoutes: FastifyPluginAsync = async (server) => {
  server.get<{ Reply: AdminOverviewResponse }>(`${ADMIN_API_PREFIX}/overview`, {
    schema: {
      tags: ['admin'],
      summary: 'Admin API overview',
      description: 'Provides the initial overview payload for the admin console.',
      response: {
        200: {
          type: 'object',
          properties: {
            app: { type: 'string' },
            docs: { type: 'string' },
            modules: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['app', 'docs', 'modules'],
        },
      },
    },
  }, async () => {
    return {
      app: APP_NAME,
      docs: DOCS_ROUTE,
      modules: ['announcements', 'events', 'economy-config'],
    };
  });
};