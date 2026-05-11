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
  '@fastify/cors',
  '@fastify/swagger',
  '@fastify/swagger-ui',
  'fastify',
];

const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
const distPackageJson = {
  name: packageJson.name,
  private: true,
  version: packageJson.version,
  type: 'module',
  scripts: {
    start: 'node index.js',
  },
  dependencies: Object.fromEntries(
    runtimeDependencies.map((dependencyName) => [dependencyName, packageJson.dependencies[dependencyName]]),
  ),
};

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

await build({
  entryPoints: [path.join(serviceRoot, 'src/index.ts')],
  outfile: path.join(distDir, 'index.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  external: runtimeDependencies,
  sourcemap: false,
  logLevel: 'info',
});

await writeFile(path.join(distDir, 'package.json'), `${JSON.stringify(distPackageJson, null, 2)}\n`, 'utf8');