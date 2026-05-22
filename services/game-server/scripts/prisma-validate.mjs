import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(serviceRoot, '../..');
const prismaCli = path.join(workspaceRoot, 'node_modules', 'prisma', 'build', 'index.js');

const result = spawnSync(
  process.execPath,
  [prismaCli, 'validate', '--schema', path.join(serviceRoot, 'prisma', 'schema.prisma')],
  {
    cwd: serviceRoot,
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL
        ?? 'postgresql://trinitywar:trinitywar@localhost:5432/trinitywar?schema=public',
    },
    stdio: 'inherit',
  },
);

process.exit(result.status ?? 1);
