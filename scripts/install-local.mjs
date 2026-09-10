// Copies the production build (dist/) into a stable, dedicated folder so the
// unpacked extension can be loaded from a location that never gets rebuilt in
// place or cleaned — which is what makes it survive PC reboots.
//
// Run with:  npm run install:local   (it builds first, then copies)
// Override the destination with:  JOT_INSTALL_DIR=... npm run install:local
import { cpSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '..', 'dist');
// NOTE: the folder name is intentionally left as "ReadingNotesExtension" even
// though the app is now called Jot. Chrome loads the unpacked extension from
// this exact path; pointing at a new folder would mean removing the old entry
// first, and removing an extension makes Chrome delete its stored notes. Keeping
// the path lets an existing install just hit Refresh and pick up the new name.
const target =
  process.env.JOT_INSTALL_DIR || join(homedir(), 'ReadingNotesExtension');

if (!existsSync(distDir)) {
  console.error('\n✗ dist/ not found. Run `npm run build` first.\n');
  process.exit(1);
}

// Replace the target's contents with the fresh build (removes stale hashed
// files). Only touched during an explicit install/update, after which you
// reload the extension — so the steady-state folder stays complete and stable.
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(distDir, target, { recursive: true });

console.log(`
✓ Jot installed to a permanent folder:

    ${target}

First time:
  1. Open chrome://extensions
  2. Turn on "Developer mode" (top-right)
  3. Click "Load unpacked" and select the folder above
  4. Keep Developer mode ON and do not delete that folder

After updating the code, just run this command again, then click the
circular refresh arrow on the Jot card in chrome://extensions.
`);
