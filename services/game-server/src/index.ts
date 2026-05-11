import Fastify from 'fastify';
import { registerCors } from './plugins/cors.js';
import { registerSwagger } from './plugins/swagger.js';
import { adminRoutes } from './routes/admin.js';
import { clientRoutes } from './routes/client.js';
import { clientHomeRoutes } from './routes/client-home.js';
import { systemRoutes } from './routes/system.js';

const server = Fastify({ logger: true });
const serverHost = process.env.HOST ?? '0.0.0.0';
const serverPort = Number(process.env.PORT ?? 3000);

const buildServer = async (): Promise<void> => {
  await registerCors(server);
  await registerSwagger(server);
  await server.register(systemRoutes);
  await server.register(clientRoutes);
  await server.register(clientHomeRoutes);
  await server.register(adminRoutes);
  await server.ready();
};

const start = async (): Promise<void> => {
  try {
    await buildServer();
    await server.listen({ port: serverPort, host: serverHost });
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
};

void start();