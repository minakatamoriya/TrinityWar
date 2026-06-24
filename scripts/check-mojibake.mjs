import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const roots = ['apps', 'services', 'packages'];
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css']);
const suspectFragments = [
  '锟�',
  '閸掗',
  '鍒锋',
  '娴兼',
  '浼樺',
  '鏈',
  '鐏靛',
  '绌烘',
  '涓讳',
  '鏂版',
  '闃佃',
  '鏀跺',
  '绋€',
  '浼犺',
  '鍏芥',
  '鐢板',
  '澶嶄',
  '鐩',
  '娆℃',
];

const findings = [];

for (const root of roots) {
  walk(root);
}

if (findings.length > 0) {
  console.error('Possible mojibake text found:');
  for (const finding of findings.slice(0, 120)) {
    console.error(`${finding.file}:${finding.line}: ${finding.text.trim()}`);
  }
  if (findings.length > 120) {
    console.error(`...and ${findings.length - 120} more`);
  }
  process.exitCode = 1;
}

function walk(path) {
  const stats = statSync(path);
  if (stats.isDirectory()) {
    if (path.includes('node_modules') || path.includes('\\dist') || path.includes('/dist')) {
      return;
    }
    for (const entry of readdirSync(path)) {
      walk(join(path, entry));
    }
    return;
  }

  if (!stats.isFile() || !extensions.has(getExtension(path))) {
    return;
  }

  const content = readFileSync(path, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (suspectFragments.some((fragment) => line.includes(fragment))) {
      findings.push({
        file: relative(process.cwd(), path),
        line: index + 1,
        text: line,
      });
    }
  });
}

function getExtension(path) {
  const match = path.match(/\.[^.\\/]+$/);
  return match?.[0] ?? '';
}
