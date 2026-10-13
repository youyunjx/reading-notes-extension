// Copies PDF.js's runtime asset bundles into public/pdfjs/ so they ship inside
// the extension and load locally (no CDN, keeping Jot offline-friendly).
//
// Why each one matters:
//   standard_fonts/ – metrics + glyphs for the 14 standard PDF fonts
//                     (Helvetica, Times, Courier...). Without these, PDFs that
//                     don't embed their fonts fall back to a substitute whose
//                     letter widths differ from what the text layer expects, so
//                     selection highlights drift out of line with the glyphs.
//   cmaps/          – character maps for CJK and other encodings, needed for
//                     correct text extraction (and therefore selection).
//   wasm/           – JBIG2 / OpenJPEG / colour-management decoders used by
//                     scanned PDFs.
//
// Run automatically as part of `npm run build`.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'node_modules', 'pdfjs-dist');
const to = join(root, 'public', 'pdfjs');

const BUNDLES = ['standard_fonts', 'cmaps', 'wasm'];

if (!existsSync(from)) {
  console.error('\n✗ pdfjs-dist not installed. Run `npm install` first.\n');
  process.exit(1);
}

rmSync(to, { recursive: true, force: true });
mkdirSync(to, { recursive: true });

for (const bundle of BUNDLES) {
  const src = join(from, bundle);
  if (!existsSync(src)) {
    console.warn(`  ! ${bundle} missing from pdfjs-dist — skipped`);
    continue;
  }
  cpSync(src, join(to, bundle), { recursive: true });
  console.log(`  copied pdfjs/${bundle}`);
}
