// Writes the recovered notes/sources directly into the installed extension's
// LevelDB storage. Chrome MUST be fully closed (it locks the database while
// running). Non-destructive: merges by id, so it's safe to run more than once.
//
// Usage:  node scripts/inject-notes.mjs
//   Profile override:  CHROME_PROFILE="Profile 1" node scripts/inject-notes.mjs
import { ClassicLevel } from 'classic-level';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const EXT_ID = 'jgbniidgmpodmknooohlnnpopndcieha'; // pinned ID of the new extension
const PROFILE = process.env.CHROME_PROFILE || 'Default';
const dbPath = join(
  homedir(),
  'AppData', 'Local', 'Google', 'Chrome', 'User Data',
  PROFILE, 'Local Extension Settings', EXT_ID,
);

const backup = JSON.parse(readFileSync('reading-notes-backup.json', 'utf8'));
const incomingNotes = Array.isArray(backup.notes) ? backup.notes : [];
const incomingSources = Array.isArray(backup.sources) ? backup.sources : [];

console.log(`Target profile: "${PROFILE}"`);
console.log(`Database:       ${dbPath}\n`);

const db = new ClassicLevel(dbPath, {
  keyEncoding: 'utf8',
  valueEncoding: 'utf8',
  createIfMissing: false,
});

try {
  await db.open();
} catch (e) {
  console.error('✗ Could not open the extension database.');
  console.error('  Chrome is almost certainly still running. Fully quit Chrome');
  console.error('  (close every window AND check the system tray / Task Manager for');
  console.error('  "chrome.exe"), then run this command again.\n');
  console.error('  Details:', e.message);
  process.exit(1);
}

const get = async (key) => {
  try {
    return await db.get(key);
  } catch {
    return undefined;
  }
};
const parse = (s) => {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
};

// Merge notes by id.
const notes = parse(await get('notes')) ?? [];
const noteIds = new Set(notes.map((n) => n?.id));
let addedNotes = 0;
for (const n of incomingNotes) {
  if (n && typeof n.id === 'string' && !noteIds.has(n.id)) {
    notes.push(n);
    noteIds.add(n.id);
    addedNotes++;
  }
}
await db.put('notes', JSON.stringify(notes));

// Merge sources by id (usually none for old backups).
const sources = parse(await get('sources')) ?? [];
const sourceIds = new Set(sources.map((s) => s?.id));
let addedSources = 0;
for (const s of incomingSources) {
  if (s && typeof s.id === 'string' && !sourceIds.has(s.id)) {
    sources.push(s);
    sourceIds.add(s.id);
    addedSources++;
  }
}
if (sources.length) await db.put('sources', JSON.stringify(sources));

await db.close();

console.log(`✓ Injected ${addedNotes} new note(s) and ${addedSources} source(s).`);
console.log(`  Total notes now in storage: ${notes.length}`);
console.log('\nReopen Chrome and open the Jot side panel — they will be there.');
