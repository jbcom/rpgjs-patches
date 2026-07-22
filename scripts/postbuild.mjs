import { mkdir, writeFile } from 'node:fs/promises';

const cjs = new URL('../dist/cjs/', import.meta.url);

await mkdir(cjs, { recursive: true });
await writeFile(new URL('package.json', cjs), '{"type":"commonjs"}\n');
