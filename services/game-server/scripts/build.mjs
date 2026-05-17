import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceRoot = path.resolve(__dirname, '..');
const distDir = path.join(serviceRoot, 'dist');
const packageJsonPath = path.join(serviceRoot, 'package.json');

const runtimeDependencies = [
  '@nestjs/common',
  '@nestjs/core',
  '@nestjs/platform-express',
  '@nestjs/swagger',
  '@prisma/client',
  '@fastify/cors',
  '@fastify/swagger',
  '@fastify/swagger-ui',
  'bullmq',
  'fastify',
  'ioredis',
  'pino',
  'reflect-metadata',
  'rxjs',
];

const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
const distPackageJson = {
  name: packageJson.name,
  private: true,
  version: packageJson.version,
  type: 'module',
  scripts: {
    start: 'node index.js',
    'worker:raid-settlement': 'node raid-settlement.worker.js',
    'worker:raid-settlement:sweep': 'node raid-settlement-sweep.js',
  },
  dependencies: Object.fromEntries(
    runtimeDependencies.map((dependencyName) => [dependencyName, packageJson.dependencies[dependencyName]]),
  ),
};

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

await build({
  entryPoints: {
    index: path.join(serviceRoot, 'src/main.ts'),
    'raid-settlement.worker': path.join(serviceRoot, 'src/raid-settlement.worker.ts'),
    'raid-settlement-sweep': path.join(serviceRoot, 'src/raid-settlement-sweep.ts'),
  },
  outdir: distDir,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  external: runtimeDependencies,
  sourcemap: false,
  logLevel: 'info',
});

await writeFile(path.join(distDir, 'package.json'), `${JSON.stringify(distPackageJson, null, 2)}\n`, 'utf8');
