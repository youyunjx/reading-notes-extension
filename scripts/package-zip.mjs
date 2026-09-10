// Builds a Chrome Web Store upload package (.zip) from dist/.
//
//  - Removes the `key` field from the manifest: the Web Store assigns its own
//    extension ID, and an uploaded `key` can be rejected. (The dev/local build
//    keeps its `key` so unpacked installs have a stable ID.)
//  - Drops *.map sourcemaps (not needed in a published build).
//
// Run with:  npm run package
import {
  cpSync,
  existsSync,
  rmSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'dist');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const stageDir = join(root, '.package', 'jot');
const zipPath = join(root, `jot-v${pkg.version}.zip`);

if (!existsSync(distDir)) {
  console.error('\n✗ dist/ not found. Run `npm run build` first.\n');
  process.exit(1);
}

// Stage a clean copy of dist without sourcemaps.
rmSync(join(root, '.package'), { recursive: true, force: true });
mkdirSync(stageDir, { recursive: true });
cpSync(distDir, stageDir, {
  recursive: true,
  filter: (src) => !src.endsWith('.map'),
});

// Strip the `key` so the Web Store assigns the published ID, and drop any
// sourcemap references (we excluded the .map files above).
const manifestPath = join(stageDir, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
delete manifest.key;
if (Array.isArray(manifest.web_accessible_resources)) {
  for (const entry of manifest.web_accessible_resources) {
    if (Array.isArray(entry.resources)) {
      entry.resources = entry.resources.filter((r) => !r.endsWith('.map'));
    }
  }
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

// Zip the staged folder's contents (manifest.json at the archive root).
rmSync(zipPath, { force: true });
execSync(
  `powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Path '${stageDir}\\*' -DestinationPath '${zipPath}' -Force"`,
  { stdio: 'inherit' },
);

console.log(`
✓ Web Store package created:

    ${zipPath}

Upload this .zip at https://chrome.google.com/webstore/devconsole
(see the "Publishing to the Chrome Web Store" section of the README).
`);
