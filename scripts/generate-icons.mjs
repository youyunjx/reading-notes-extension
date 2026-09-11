// Generates the extension icons (16/48/128 px) from the master logo at
// assets/logo.png.
//
// The generated PNGs are committed to the repo, so you only need to run this
// when the logo changes:
//
//   npm install --no-save sharp
//   node scripts/generate-icons.mjs
//
// sharp is intentionally NOT a saved dependency — it's a heavyweight native
// package and nobody needs it just to build the extension.
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'assets', 'logo.png');
const outDir = join(root, 'public', 'icons');
const SIZES = [16, 48, 128];

if (!existsSync(source)) {
  console.error(`\n✗ Master logo not found at ${source}\n`);
  process.exit(1);
}

let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.error('\n✗ sharp is not installed. Run:  npm install --no-save sharp\n');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

for (const size of SIZES) {
  const out = join(outDir, `icon${size}.png`);
  await sharp(source)
    // `contain` + transparent background preserves the logo's own rounded
    // corners instead of cropping them.
    .resize(size, size, {
      fit: 'contain',
      kernel: 'lanczos3',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`wrote icons/icon${size}.png`);
}

console.log('\n✓ Icons regenerated from assets/logo.png');
