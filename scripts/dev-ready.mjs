import { spawnSync } from 'node:child_process';
import process from 'node:process';

const checks = [
  {
    label: 'build shared package',
    command: 'npm',
    args: ['run', 'build:shared'],
    cwd: process.cwd(),
  },
  {
    label: 'check Prisma migration status',
    command: 'npx',
    args: ['prisma', 'migrate', 'status', '--schema', 'prisma/schema.prisma'],
    cwd: 'services/game-server',
  },
  {
    label: 'generate Prisma client',
    command: 'npm',
    args: ['run', 'prisma:generate', '--workspace', '@trinitywar/game-server'],
    cwd: process.cwd(),
  },
  {
    label: 'run server smoke flow',
    command: 'npm',
    args: ['run', 'verify:test-flow', '--workspace', '@trinitywar/game-server'],
    cwd: process.cwd(),
  },
];

for (const check of checks) {
  console.log(`\n[dev-ready] ${check.label}`);
  const result = spawnSync(check.command, check.args, {
    cwd: check.cwd,
    shell: true,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    console.error(`\n[dev-ready] failed: ${check.label}`);
    process.exit(result.status ?? 1);
  }
}

console.log('\n[dev-ready] local workspace is ready.');
