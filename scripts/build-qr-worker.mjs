import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const output = join(root, 'public', 'vendor');
await mkdir(output, { recursive: true });

await build({
  entryPoints: [join(root, 'src', 'components', 'organizer', 'qrDecodeWorker.ts')],
  outfile: join(output, 'qr-decode-worker.js'),
  bundle: true,
  platform: 'browser',
  format: 'iife',
  target: 'es2022',
  minify: true,
});

await copyFile(
  join(root, 'node_modules', 'zxing-wasm', 'dist', 'reader', 'zxing_reader.wasm'),
  join(output, 'zxing_reader.wasm'),
);
