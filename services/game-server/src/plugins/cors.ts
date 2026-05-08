import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';

export const registerCors = async (server: FastifyInstance): Promise<void> => {
  await server.register(cors, {
    origin: true,
  });
};