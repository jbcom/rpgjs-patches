import { build } from 'esbuild';

const root = new URL('../', import.meta.url);

await build({
  absWorkingDir: root.pathname,
  bundle: true,
  entryPoints: ['src/index.ts'],
  external: ['canvasengine'],
  format: 'cjs',
  outfile: 'dist/cjs/index.js',
  platform: 'node',
  sourcemap: true,
  target: 'node24',
});
