// Builds dist/ for deploy: just the game (index.html + src + assets).
// Run: node tools/make-dist.mjs
import { cpSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(root, 'index.html'), join(dist, 'index.html'));
cpSync(join(root, 'src'), join(dist, 'src'), { recursive: true });
cpSync(join(root, 'assets'), join(dist, 'assets'), { recursive: true });
writeFileSync(join(dist, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n');
console.log('dist/ built: index.html + src/ + assets/');
